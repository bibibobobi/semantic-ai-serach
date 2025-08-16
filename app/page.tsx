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
  fullDescription?: string;
  category: string;
  duration: string;
  publishDate: string;
  tags: string[];
  relevanceScore?: number;
}

function semanticSearch(query: string, podcasts: Podcast[]): Podcast[] {
  if (!query.trim()) return podcasts;

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

      // 計算相關性分數
      searchTerms.forEach((term) => {
        // 完全匹配
        if (searchContent.includes(term)) {
          score += 10;
        }

        // 語義相關詞匯匹配（簡化版）
        const semanticMap: Record<string, string[]> = {
          美食: [
            "餐廳",
            "料理",
            "吃",
            "食物",
            "菜",
            "鍋",
            "丼",
            "燒鳥",
            "川菜",
            "蔬食",
          ],
          旅行: [
            "旅遊",
            "景點",
            "地方",
            "城市",
            "溫泉",
            "日本",
            "桃園",
            "露營",
          ],
          財經: [
            "投資",
            "企業",
            "金融",
            "理財",
            "股票",
            "經濟",
            "商業",
            "產業",
          ],
          社會: ["詐騙", "犯罪", "議題", "問題", "移工", "司法", "逃稅"],
          娛樂: ["明星", "藝人", "爆料", "八卦", "電影", "戲劇", "影視"],
          人物: ["故事", "專訪", "訪談", "創業", "企業家", "母親", "家庭"],
          科技: ["電子", "製造", "連接器", "導軌", "雲端", "智能"],
          醫療: ["健康", "疾病", "醫院", "治療", "藥物", "SARS", "疫情"],
        };

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

  const categories = useMemo(() => {
    const cats = [...new Set(podcastData.map((p) => p.category))];
    return cats;
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    podcastData.forEach((p) => p.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() && !selectedCategory) {
        setResults(podcastData);
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

      // 語義搜尋
      if (searchQuery.trim()) {
        filtered = semanticSearch(searchQuery, filtered).map((podcast) => ({
          ...podcast,
          fullDescription: podcast.fullDescription ?? "",
        }));
      }

      setResults(filtered);
      setIsSearching(false);
      setSearchStatus("");
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory]);

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
    "社會議題",
    "日本旅遊",
    "企業故事",
    "娛樂影視",
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-1">
                  {/* Siri-like mini wave in search box */}
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-blue-500 rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.random() * 8}px`,
                        animationDelay: `${i * 150}ms`,
                        animationDuration: `${600 + Math.random() * 200}ms`,
                      }}
                    />
                  ))}
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

        {/* Siri-like AI Thinking Animation */}
        {isSearching && (
          <div className="mb-4 p-6 bg-gradient-to-r from-slate-50 via-blue-50 to-purple-50 rounded-2xl border border-blue-100 shadow-sm">
            <div className="flex flex-col items-center space-y-4">
              {/* Siri Wave Animation */}
              <div className="flex items-center justify-center w-full h-16">
                <div className="flex items-end space-x-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-blue-400 via-purple-500 to-indigo-600 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 40 + 10}px`,
                        animationDelay: `${i * 100}ms`,
                        animationDuration: `${800 + Math.random() * 400}ms`,
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
                    className="w-2 h-2 bg-purple-500 rounded-full animate-ping"
                    style={{ animationDelay: "0.5s" }}
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
                        animation: `float ${
                          2 + Math.random()
                        }s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
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
            {isSearching ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span>AI 正在搜尋中...</span>
              </span>
            ) : (
              <>
                搜尋結果 ({results.length} 個節目)
                {searchQuery && (
                  <span className="text-blue-600 ml-2">
                    關於 &quot;{searchQuery}&quot;
                  </span>
                )}
              </>
            )}
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {isSearching ? (
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
                          animation: `wave ${
                            1000 + i * 50
                          }ms ease-in-out infinite`,
                          animationDelay: `${i * 100}ms`,
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
                        animation: `orbit ${3000 + i * 200}ms linear infinite`,
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
                      className="w-3 h-3 bg-green-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.5s" }}
                    />
                    <span>匹配內容</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <div
                      className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"
                      style={{ animationDelay: "1s" }}
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
            •
            搜尋算法會理解語義相關性，例如搜尋「美食」會找到「川菜」、「餐廳」等相關內容
          </p>
          <p>
            • <strong>AI 思考動畫</strong>：模擬真實 API 調用過程（分析意圖 →
            生成向量 → 計算相似度 → 排序結果）
          </p>
          <p>• 實際應用中會整合 OpenAI Embeddings API 或其他向量資料庫</p>
          <p>• 試試搜尋：「投資理財」、「日本旅遊」、「企業故事」等關鍵詞</p>
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
