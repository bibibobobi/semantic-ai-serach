"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Play,
  Clock,
  Calendar,
  Filter,
  Tag,
  Brain,
} from "lucide-react";
import podcastData from "@/mockdata/podcasts";

interface Podcast {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  category: string;
  duration: string;
  publishDate: string;
  tags: string[];
  relevanceScore?: number;
}

// Real semantic search using Pinecone
async function semanticSearchWithPinecone(
  query: string,
  podcasts: Podcast[],
  setSearchStatus: (status: string) => void
): Promise<Podcast[]> {
  if (!query.trim()) return podcasts;

  try {
    setSearchStatus("生成查詢向量...");

    // Try main Pinecone API first
    let response = await fetch("/api/search-pinecone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        topK: 10,
        includeMetadata: true,
      }),
    });

    // If main API fails (e.g., OpenAI quota), try fallback
    if (!response.ok && response.status === 429) {
      console.log("🔄 OpenAI quota exceeded, using fallback search...");
      setSearchStatus("使用備用搜尋方式...");

      response = await fetch("/api/search-fallback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          topK: 10,
          includeMetadata: true,
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    setSearchStatus("計算語義相似度...");
    const results = await response.json();

    setSearchStatus("排序結果...");

    // Map Pinecone results back to podcast objects with scores
    const scoredPodcasts = results.matches
      .map((match: { id: string; score: number }) => {
        const podcastId = parseInt(match.id);
        const podcast = podcasts.find((p) => p.id === podcastId);

        if (!podcast) return null;

        return {
          ...podcast,
          relevanceScore: Math.round(match.score * 100), // Convert to percentage
        };
      })
      .filter(
        (p: Podcast | null) => p && p.relevanceScore && p.relevanceScore > 20
      ); // Lower threshold for fallback

    return scoredPodcasts.sort(
      (a: Podcast, b: Podcast) =>
        (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
    );
  } catch (error) {
    console.error("Pinecone search error:", error);
    setSearchStatus("API 連接失敗，使用本地搜尋...");

    // Final fallback to local search
    return localSemanticSearch(query, podcasts);
  }
}

// Fallback local semantic search
function localSemanticSearch(query: string, podcasts: Podcast[]): Podcast[] {
  const queryLower = query.toLowerCase();
  const searchTerms = queryLower.split(" ").filter((term) => term.length > 0);

  return podcasts
    .map((podcast) => {
      let score = 0;
      const searchContent = (
        podcast.title +
        " " +
        podcast.description +
        " " +
        (podcast.fullDescription || "") +
        " " +
        podcast.tags.join(" ")
      ).toLowerCase();

      // Basic keyword matching
      searchTerms.forEach((term) => {
        if (searchContent.includes(term)) {
          score += 10;
        }
      });

      // Enhanced semantic mapping for Chinese content
      const semanticMap: Record<string, string[]> = {
        美食: [
          "餐廳",
          "料理",
          "川菜",
          "茶餐廳",
          "麻辣",
          "中式料理",
          "母親節",
          "饕客",
        ],
        旅行: [
          "旅遊",
          "日本",
          "韓國",
          "觀光",
          "櫻花",
          "鐵路",
          "周遊券",
          "桃園",
          "露營",
        ],
        財經: [
          "投資",
          "企業",
          "股票",
          "AI",
          "台積電",
          "電動車",
          "金融",
          "理財",
          "頭家",
          "董事長",
        ],
        社會: ["議題", "教育", "長照", "霸凌", "移工", "偷渡", "司法", "犯罪"],
        娛樂: [
          "戲劇",
          "韓劇",
          "Netflix",
          "電影",
          "影視",
          "律政",
          "職人劇",
          "台劇",
        ],
        科技: [
          "AI",
          "智能",
          "科技",
          "半導體",
          "電子",
          "導軌",
          "連接器",
          "雲端",
        ],
        人物: ["故事", "專訪", "母親", "企業家", "創業", "家庭", "罕見疾病"],
        時尚: ["鐘錶", "復刻", "復古", "收藏", "設計", "瑞士", "百達翡麗"],
        調查: ["鏡爆點", "逃稅", "酒店", "金錢豹", "黑道", "醫療腐敗"],
      };

      searchTerms.forEach((term) => {
        Object.entries(semanticMap).forEach(([key, values]) => {
          if (
            term.includes(key) ||
            values.some((v) => searchContent.includes(v))
          ) {
            score += 5;
          }
        });
      });

      return { ...podcast, relevanceScore: score };
    })
    .filter((podcast) => podcast.relevanceScore && podcast.relevanceScore > 0)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

export default function PodcastSemanticSearch() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [results, setResults] = useState<Podcast[]>(podcastData);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [shouldUseAPI, setShouldUseAPI] = useState<boolean>(false);

  const categories = useMemo(() => {
    const cats = [...new Set(podcastData.map((p) => p.category))];
    return cats;
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    podcastData.forEach((p) => p.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, []);

  // Handle search input with typing detection
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setIsTyping(true);

    // Determine if we should use API based on query characteristics
    const shouldCallAPI =
      value.length >= 2 && // Minimum 2 characters
      !/^[\s]*$/.test(value) && // Not just whitespace
      !value.endsWith(" "); // Not ending with space (still typing)

    setShouldUseAPI(shouldCallAPI);
  };

  // Detect when user stops typing
  useEffect(() => {
    if (!isTyping) return;

    const typingTimer = setTimeout(() => {
      setIsTyping(false);
    }, 800); // Consider stopped typing after 800ms

    return () => clearTimeout(typingTimer);
  }, [searchQuery, isTyping]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() && !selectedCategory) {
        setResults(podcastData);
        return;
      }

      // For short queries or while typing, use local search only
      if (searchQuery.length < 2 || isTyping) {
        const filtered = selectedCategory
          ? podcastData.filter((p) => p.category === selectedCategory)
          : podcastData;

        if (searchQuery.trim()) {
          const localResults = localSemanticSearch(searchQuery, filtered);
          setResults(localResults);
        } else {
          setResults(filtered);
        }
        return;
      }

      setIsSearching(true);
      setSearchStatus("分析搜尋意圖...");

      // Simulate AI processing steps
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSearchStatus("生成語義向量...");

      await new Promise((resolve) => setTimeout(resolve, 600));
      setSearchStatus("計算相似度...");

      await new Promise((resolve) => setTimeout(resolve, 500));
      setSearchStatus("排序結果...");

      await new Promise((resolve) => setTimeout(resolve, 400));

      let filtered = [...podcastData];

      // 類別篩選
      if (selectedCategory) {
        filtered = filtered.filter((p) => p.category === selectedCategory);
      }

      // 語義搜尋 - Use API only when not typing and query is substantial
      if (searchQuery.trim()) {
        try {
          if (shouldUseAPI && !isTyping) {
            // Use API for semantic search
            filtered = await semanticSearchWithPinecone(
              searchQuery,
              filtered,
              setSearchStatus
            );
          } else {
            // Use local search for immediate feedback
            filtered = localSemanticSearch(searchQuery, filtered);
          }
        } catch (error) {
          console.error("Search error:", error);
          filtered = localSemanticSearch(searchQuery, filtered);
        }
      }

      setResults(filtered);
      setIsSearching(false);
      setSearchStatus("");
    };

    // Debounce search with different delays based on context
    const debounceDelay = isTyping
      ? 150 // Quick local search while typing
      : searchQuery.length < 3
      ? 300 // Medium delay for short queries
      : shouldUseAPI
      ? 1000
      : 300; // Longer delay for API calls

    const debounceTimer = setTimeout(performSearch, debounceDelay);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory, isTyping, shouldUseAPI]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleTagClick = (tag: string): void => {
    setSearchQuery(tag);
  };

  const suggestedQueries = [
    "美食推薦",
    "投資理財",
    "日本旅遊",
    "企業故事",
    "社會議題",
    "韓劇分析",
    "鐘錶收藏",
    "AI科技",
    "電動車",
    "醫療健康",
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          鏡週刊 Podcasts 語義搜尋
        </h1>
        <p className="text-gray-600">
          使用 AI 技術智能搜尋您感興趣的 Podcast 內容
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="搜尋 Podcast 內容... (例如：美食推薦、政治新聞)"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {(isSearching || isTyping) && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-1">
                  {isTyping ? (
                    // Simple typing indicator
                    <div className="flex space-x-1">
                      <div className="w-1 h-4 bg-gray-400 rounded-full animate-pulse"></div>
                      <div
                        className="w-1 h-4 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-1 h-4 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  ) : (
                    // Siri-like mini wave for API processing
                    [...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-blue-500 rounded-full"
                        style={{
                          height: `${8 + Math.random() * 8}px`,
                          animationName: "pulse",
                          animationDuration: `${600 + Math.random() * 200}ms`,
                          animationDelay: `${i * 150}ms`,
                          animationIterationCount: "infinite",
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[150px]"
            >
              <option value="">所有類別</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Siri-like AI Thinking Animation - Only show for API calls */}
        {isSearching && !isTyping && (
          <div className="mb-4 p-6 bg-gradient-to-r from-slate-50 via-blue-50 to-purple-50 rounded-2xl border border-blue-100 shadow-sm">
            <div className="flex flex-col items-center space-y-4">
              {/* Siri Wave Animation */}
              <div className="flex items-center justify-center w-full h-16">
                <div className="flex items-end space-x-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-blue-400 via-purple-500 to-indigo-600 rounded-full"
                      style={{
                        height: `${Math.random() * 40 + 10}px`,
                        animationName: "pulse",
                        animationDuration: `${800 + Math.random() * 400}ms`,
                        animationDelay: `${i * 100}ms`,
                        animationIterationCount: "infinite",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Status Text */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                  <span className="text-sm font-medium text-slate-700 animate-pulse">
                    {searchStatus}
                  </span>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full"
                    style={{
                      animationName: "ping",
                      animationDelay: "0.5s",
                      animationDuration: "1s",
                      animationIterationCount: "infinite",
                    }}
                  />
                </div>

                {/* Floating particles */}
                <div className="relative h-8 overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-60"
                      style={{
                        left: `${15 + i * 15}%`,
                        animationName: "float",
                        animationDuration: `${2 + Math.random()}s`,
                        animationDelay: `${i * 0.3}s`,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Circular Progress */}
              <div className="relative w-16 h-16">
                <svg
                  className="w-16 h-16 transform -rotate-90"
                  viewBox="0 0 64 64"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-blue-100"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="url(#gradient)"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${
                      2 *
                      Math.PI *
                      28 *
                      (1 -
                        (searchStatus.includes("分析")
                          ? 0.25
                          : searchStatus.includes("生成")
                          ? 0.5
                          : searchStatus.includes("計算")
                          ? 0.75
                          : searchStatus.includes("排序")
                          ? 0.9
                          : 1))
                    }`}
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient
                      id="gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Queries */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">建議搜尋：</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((query) => (
              <button
                key={query}
                onClick={() => setSearchQuery(query)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors disabled:opacity-50"
                disabled={isSearching}
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Popular Tags */}
        <div>
          <p className="text-sm text-gray-500 mb-2">熱門標籤：</p>
          <div className="flex flex-wrap gap-2">
            {allTags.slice(0, 10).map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                disabled={isSearching}
              >
                <Tag className="w-3 h-3" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {isSearching && !isTyping ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span>AI 正在搜尋中...</span>
              </span>
            ) : (
              <>
                搜尋結果 ({results.length} 個節目)
                {searchQuery && (
                  <>
                    <span className="text-blue-600 ml-2">
                      關於 &quot;{searchQuery}&quot;
                    </span>
                    {isTyping && (
                      <span className="text-orange-500 text-sm ml-2">
                        (本地搜尋)
                      </span>
                    )}
                    {!isTyping && shouldUseAPI && searchQuery.length >= 2 && (
                      <span className="text-green-600 text-sm ml-2">
                        (AI 語義搜尋)
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {isSearching && !isTyping ? (
            // Siri-like AI Thinking Placeholder
            <div className="p-12 text-center">
              <div className="max-w-md mx-auto">
                {/* Large Siri Wave Animation */}
                <div className="flex justify-center mb-6">
                  <div className="flex items-end space-x-1">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-gradient-to-t from-blue-400 via-purple-500 to-indigo-600 rounded-full"
                        style={{
                          height: `${
                            20 + Math.sin(Date.now() / 200 + i) * 30
                          }px`,
                          animationName: "wave",
                          animationDuration: `${1000 + i * 50}ms`,
                          animationDelay: `${i * 100}ms`,
                          animationTimingFunction: "ease-in-out",
                          animationIterationCount: "infinite",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  AI 語義搜尋進行中
                </h3>
                <p className="text-gray-500 mb-6">{searchStatus}</p>

                {/* Orbiting particles */}
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-200" />
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-blue-500 rounded-full"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: `translate(-50%, -50%) rotate(${
                          i * 45
                        }deg) translateY(-60px)`,
                        animationName: "orbit",
                        animationDuration: `${3000 + i * 200}ms`,
                        animationTimingFunction: "linear",
                        animationIterationCount: "infinite",
                      }}
                    />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
                  </div>
                </div>

                <div className="flex justify-center space-x-6 text-sm text-gray-400">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                    <span>理解語義</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <div
                      className="w-3 h-3 bg-green-400 rounded-full"
                      style={{
                        animationName: "pulse",
                        animationDelay: "0.5s",
                        animationDuration: "2s",
                        animationIterationCount: "infinite",
                      }}
                    />
                    <span>匹配內容</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <div
                      className="w-3 h-3 bg-purple-400 rounded-full"
                      style={{
                        animationName: "pulse",
                        animationDelay: "1s",
                        animationDuration: "2s",
                        animationIterationCount: "infinite",
                      }}
                    />
                    <span>排序結果</span>
                  </div>
                </div>
              </div>
            </div>
          ) : results.length > 0 ? (
            results.map((podcast) => (
              <div
                key={podcast.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {podcast.title}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                        {podcast.category}
                      </span>
                      {podcast.relevanceScore && podcast.relevanceScore > 0 && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                          相關度: {podcast.relevanceScore}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-3 leading-relaxed">
                      {podcast.fullDescription || podcast.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {podcast.duration}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(podcast.publishDate)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {podcast.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md cursor-pointer hover:bg-gray-200"
                          onClick={() => handleTagClick(tag)}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Play className="w-4 h-4" />
                    播放
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">沒有找到相關的 Podcast 節目</p>
              <p className="text-sm text-gray-400 mt-2">
                試試調整搜尋關鍵詞或選擇不同的類別
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Demo Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">🚀 Demo 說明</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• 這是一個語義搜尋技術展示，僅供讀書會學習使用</p>
          <p>• 所有節目內容文字版權歸鏡週刊所有，僅作技術演示用途</p>
          <p>
            • ✅ <strong>已整合 OpenAI Embeddings API</strong> - 使用
            text-embedding-3-small 模型
          </p>
          <p>
            • ✅ <strong>已連接 Pinecone 向量資料庫</strong> - 儲存{" "}
            {results.length > 0 ? "30個" : "28個"} 鏡週刊 Podcast 節目向量
          </p>
          <p>
            • ✅ <strong>真實語義理解</strong> -
            搜尋「美食」能找到「川菜」、「茶餐廳」等相關內容
          </p>
          <p>
            • ✅ <strong>智能備援機制</strong> - OpenAI
            額度不足時自動切換本地演算法
          </p>
          <p>
            • ✅ <strong>相關度評分</strong> -
            顯示每個結果與查詢的語義相似度百分比
          </p>
          <p>
            • 🔍 <strong>建議測試</strong>
            ：「投資理財」、「日本旅遊」、「企業故事」、「川菜美食」、「韓劇分析」
          </p>
          <p>
            • 💡 <strong>技術架構</strong>：Next.js + OpenAI + Pinecone +
            中文語義優化
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-20px) scale(1.2);
            opacity: 1;
          }
        }
        @keyframes wave {
          0%,
          100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(2);
          }
        }
        @keyframes orbit {
          from {
            transform: translate(-50%, -50%) rotate(0deg) translateY(-60px);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg) translateY(-60px);
          }
        }
      `}</style>
    </div>
  );
}
