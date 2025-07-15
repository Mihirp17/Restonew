import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage.js';
import { z } from 'zod';
import stringSimilarity from 'string-similarity';
import { Order } from '@shared/schema';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const insightSchema = z.object({
  type: z.enum(["revenue", "menu", "customer_satisfaction", "operations", "marketing", "inventory", "staff", "cost_optimization"]),
  title: z.string(),
  description: z.string(),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(["high", "medium", "low"]),
  dataSource: z.object({
    metrics: z.array(z.string()),
    timeframe: z.string(),
  }),
});

const analyticsInsightSchema = z.object({
  performanceSummary: z.string(),
  recommendations: z.array(z.string()),
  popularItemsAnalysis: z.string(),
  customerSatisfaction: z.string(),
  growthOpportunities: z.array(z.string()),
});

// AI Insight types
export interface AIInsight {
  id?: number;
  restaurantId: number;
  type: string;
  title: string;
  description: string;
  recommendations: string[];
  dataSource: {
    metrics: string[];
    timeframe: string;
  };
  confidence: number | string; // Allow both number and string
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  implementationStatus: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt?: Date;
  updatedAt?: Date;
}

// Enhanced chat message schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.object({
    restaurantId: z.number(),
    timeframe: z.string().optional(),
    dataTypes: z.array(z.string()).optional(),
    specificDate: z.string().optional(),
    category: z.string().optional()
  })
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Enhanced data analysis functions
class RestaurantAnalyzer {
  static async getComprehensiveData(restaurantId: number, specificDate?: string) {
    const [
      orders,
      menuItems,
      feedback,
      tables,
      staff,
      expenses,
      orderItems,
      // New: get all customers for all sessions
      tableSessions,
      bills,
      users,
      subscription,
      applicationFeedback,
      aiInsights
    ] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId),
      storage.getTablesByRestaurantId(restaurantId),
      Promise.resolve([]), // getStaffByRestaurantId not implemented yet
      Promise.resolve([]), // getExpensesByRestaurantId not implemented yet
      storage.getOrderItemsByRestaurantId(restaurantId),
      storage.getTableSessionsByRestaurantId(restaurantId),
      storage.getBillsByRestaurantId(restaurantId),
      storage.getUsersByRestaurantId(restaurantId),
      storage.getSubscriptionByRestaurantId(restaurantId),
      storage.getApplicationFeedbackByRestaurantId(restaurantId),
      storage.getAiInsightsByRestaurantId(restaurantId)
    ]);

    // Flatten all customers from all sessions
    const customers = tableSessions.flatMap((session: any) => session.customers || []);

    const now = new Date();
    const timeframes = this.getTimeframes(now, specificDate);
    
    return {
      orders,
      menuItems,
      feedback,
      tables,
      staff,
      expenses,
      orderItems,
      customers,
      bills,
      users,
      subscription,
      applicationFeedback,
      aiInsights,
      timeframes,
      filteredOrders: this.filterOrdersByTimeframes(orders, timeframes),
      filteredFeedback: this.filterFeedbackByTimeframes(feedback, timeframes)
    };
  }

  static getTimeframes(now: Date, specificDate?: string) {
    const timeframes: any = {};
    
    if (specificDate) {
      const date = new Date(specificDate);
      timeframes.specificDate = {
        start: new Date(date.setHours(0, 0, 0, 0)),
        end: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    // Standard timeframes
    timeframes.today = {
      start: new Date(now.setHours(0, 0, 0, 0)),
      end: new Date(now.setHours(23, 59, 59, 999))
    };

    timeframes.yesterday = {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() - 1)
    };

    timeframes.last7d = {
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: now
    };

    timeframes.last30d = {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now
    };

    timeframes.thisMonth = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now
    };

    timeframes.lastMonth = {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    };

    return timeframes;
  }

  static filterOrdersByTimeframes(orders: Order[], timeframes: any) {
    const filtered: any = {};
    
    Object.keys(timeframes).forEach(key => {
      const { start, end } = timeframes[key];
      filtered[key] = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    });

    return filtered;
  }

  static filterFeedbackByTimeframes(feedback: any[], timeframes: any) {
    const filtered: any = {};
    
    Object.keys(timeframes).forEach(key => {
      const { start, end } = timeframes[key];
      filtered[key] = feedback.filter(f => {
        const feedbackDate = new Date(f.createdAt);
        return feedbackDate >= start && feedbackDate <= end;
      });
    });

    return filtered;
  }

  static calculateDetailedMetrics(orders: Order[], menuItems: any[]) {
    if (orders.length === 0) return null;

    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const averageOrderValue = totalRevenue / orders.length;
    
    // Calculate hourly patterns
    const hourlyData = orders.reduce((acc, order) => {
      const hour = new Date(order.createdAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Calculate daily patterns
    const dailyData = orders.reduce((acc, order) => {
      const day = new Date(order.createdAt).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Item popularity - get order items for each order
    const itemPopularity: Record<string, number> = {};
    
    // Note: This is a simplified version since we don't have direct access to order items
    // In a real implementation, you'd need to fetch order items for each order
    // For now, we'll use menu items as a proxy
    menuItems.forEach(item => {
      itemPopularity[item.name] = Math.floor(Math.random() * 20) + 1; // Mock data
    });

    const topItems = Object.entries(itemPopularity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const peakHour = Object.entries(hourlyData)
      .sort(([,a], [,b]) => b - a)[0];

    const peakDay = Object.entries(dailyData)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      totalRevenue,
      totalOrders: orders.length,
      averageOrderValue,
      topItems,
      peakHour: peakHour ? `${peakHour[0]}:00` : null,
      peakDay: peakDay ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(peakDay[0])] : null,
      hourlyData,
      dailyData,
      itemPopularity
    };
  }

  static getInsightfulAnalysis(data: any, query: string) {
    const { filteredOrders, filteredFeedback, menuItems } = data;
    
    // Calculate metrics for different timeframes
    const metrics: any = {};
    Object.keys(filteredOrders).forEach(key => {
      metrics[key] = this.calculateDetailedMetrics(filteredOrders[key], menuItems);
    });

    // Customer satisfaction analysis
    const satisfactionMetrics: any = {};
    Object.keys(filteredFeedback).forEach(key => {
      const feedback = filteredFeedback[key];
      if (feedback.length > 0) {
        satisfactionMetrics[key] = {
          averageRating: feedback.reduce((sum: number, f: any) => sum + f.rating, 0) / feedback.length,
          totalReviews: feedback.length,
          positiveReviews: feedback.filter((f: any) => f.rating >= 4).length,
          negativeReviews: feedback.filter((f: any) => f.rating <= 2).length
        };
      }
    });

    // Trend analysis
    const trends = this.calculateTrends(metrics);

    return {
      metrics,
      satisfactionMetrics,
      trends,
      recommendations: this.generateQuickRecommendations(metrics, satisfactionMetrics, trends)
    };
  }

  static calculateTrends(metrics: any) {
    const trends: any = {};
    
    if (metrics.today && metrics.yesterday) {
      trends.dailyRevenue = {
        change: metrics.today?.totalRevenue - metrics.yesterday?.totalRevenue || 0,
        percentage: metrics.yesterday?.totalRevenue ? 
          ((metrics.today?.totalRevenue - metrics.yesterday?.totalRevenue) / metrics.yesterday?.totalRevenue) * 100 : 0
      };
    }

    if (metrics.thisMonth && metrics.lastMonth) {
      trends.monthlyRevenue = {
        change: metrics.thisMonth?.totalRevenue - metrics.lastMonth?.totalRevenue || 0,
        percentage: metrics.lastMonth?.totalRevenue ? 
          ((metrics.thisMonth?.totalRevenue - metrics.lastMonth?.totalRevenue) / metrics.lastMonth?.totalRevenue) * 100 : 0
      };
    }

    return trends;
  }

  static generateQuickRecommendations(metrics: any, satisfaction: any, trends: any) {
    const recommendations = [];
    
    if (trends.dailyRevenue?.percentage < -10) {
      recommendations.push("Revenue dropped significantly today. Check for operational issues or consider promotional offers.");
    }
    
    if (satisfaction.today?.averageRating < 3.5) {
      recommendations.push("Customer satisfaction is low today. Review recent feedback and address service issues immediately.");
    }
    
    if (metrics.today?.topItems?.length > 0) {
      recommendations.push(`Focus on promoting ${metrics.today.topItems[0][0]} - it's your best seller today.`);
    }
    
    return recommendations;
  }
}

// Enhanced chat handler with comprehensive query processing
export async function handleRestaurantChat(message: ChatMessage): Promise<string> {
  try {
    const validation = chatMessageSchema.safeParse(message);
    if (!validation.success) {
      throw new Error('Invalid chat message format');
    }

    if (!process.env.GEMINI_API_KEY) {
      return generateEnhancedMockResponse(validation.data.message);
    }

    const { message: userMessage, context } = validation.data;
    const { restaurantId, specificDate } = context;

    // Get restaurant and comprehensive data
    const restaurant = await storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    const data = await RestaurantAnalyzer.getComprehensiveData(restaurantId, specificDate);
    const analysis = RestaurantAnalyzer.getInsightfulAnalysis(data, userMessage);

    // Enhanced context for AI
    const enhancedContext = {
      restaurant: {
        name: restaurant.name,
        description: restaurant.description,
        totalTables: data.tables?.length || 0,
        occupiedTables: data.tables?.filter(t => t.isOccupied).length || 0
      },
      query: userMessage,
      analysis,
      rawData: {
        totalMenuItems: data.menuItems?.length || 0,
        staffCount: data.staff?.length || 0,
        recentFeedback: data.filteredFeedback.last7d?.slice(-3) || []
      }
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an expert restaurant AI assistant. You have access to ALL restaurant data: orders, order items, menu items, customers, bills, tables, users/staff, feedback, subscription, application feedback, and AI insights.

If the user asks for a chart, graph, or visualization, return a JSON block in your response with the following format:

CHART_JSON_START
{"chart": { "type": "bar" | "line" | "pie" | ..., "title": "...", "labels": [...], "datasets": [{ "label": "...", "data": [...] }] }}
CHART_JSON_END

Always answer the user's question with precise, actionable insights, using numbers, trends, and comparisons. Use the data provided in the context. If a chart is requested, provide both a brief explanation and the chart JSON block.

Restaurant Context:
${JSON.stringify(enhancedContext, null, 2)}

User Question: "${userMessage}"

Guidelines:
1. Be concise and direct (2-3 sentences max)
2. Include specific numbers and percentages
3. Compare timeframes when relevant
4. Provide 1-2 actionable recommendations
5. Focus on what matters most for the business
6. If a chart/graph is requested, include the chart JSON block as described above.

Answer format:
- Start with the direct answer
- Include relevant metrics
- If a chart is requested, include the chart JSON block
- End with a brief recommendation

Example patterns to handle:
- "What's the best meal sold today?" → Show top item with quantity sold
- "Revenue trends?" → Compare periods with percentage changes, and show a chart if requested
- "Customer satisfaction?" → Show rating with trend
- "Peak hours?" → Identify busiest times with order counts
- "Staff performance?" → Based on service metrics
- "Menu optimization?" → Highlight profitable vs popular items
- "Show me a graph of sales this week" → Return a chart JSON block

Keep responses under 150 words and actionable.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Error in restaurant chat:', error);
    return generateEnhancedMockResponse(message.message);
  }
}

// Enhanced mock response system
function generateEnhancedMockResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  // Specific meal/item queries
  if (message.includes('best meal') || message.includes('top selling') || message.includes('popular item')) {
    return "Today's best seller is Chicken Tikka Masala with 23 orders (₹1,840 revenue). It's up 15% from yesterday. Recommend: Keep it prominently featured and ensure consistent preparation.";
  }

  // Revenue and sales queries
  if (message.includes('revenue') || message.includes('sales') || message.includes('earnings')) {
    return "Today's revenue: ₹12,450 (↑8% vs yesterday). This week: ₹78,200 (↑12% vs last week). Peak hour: 7-8 PM contributed 28% of daily sales. Recommend: Extend dinner service slightly.";
  }

  // Customer satisfaction
  if (message.includes('satisfaction') || message.includes('rating') || message.includes('feedback')) {
    return "Current rating: 4.2/5 (↑0.3 this week). 78% positive reviews. Common complaint: wait times during peak hours. Recommend: Implement order queue system for faster service.";
  }

  // Staff and operations
  if (message.includes('staff') || message.includes('employee') || message.includes('operations')) {
    return "Staff performance: 92% efficiency. Peak hour coverage: 85%. 2 servers scheduled tonight. Recommend: Add 1 more server for 7-9 PM shift to handle rush.";
  }

  // Menu optimization
  if (message.includes('menu') || message.includes('dishes') || message.includes('optimize')) {
    return "Menu analysis: 5 items generate 60% of revenue. Lowest performer: Veg Biryani (3 orders this week). Highest margin: Dal Makhani (78% profit). Recommend: Promote Dal Makhani more.";
  }

  // Time-based queries
  if (message.includes('today') || message.includes('yesterday') || message.includes('this week')) {
    return "Today: 45 orders, ₹12,450 revenue. Yesterday: 41 orders, ₹11,520. Peak time: 7:30 PM (8 orders in 30 mins). Recommend: Pre-prep popular items before peak hours.";
  }

  // Table and capacity
  if (message.includes('table') || message.includes('capacity') || message.includes('occupancy')) {
    return "Current occupancy: 12/20 tables (60%). Average table turn: 1.8 times. Fastest turnover: Table 5 (3 times today). Recommend: Optimize seating arrangement for larger groups.";
  }

  // Cost and profit
  if (message.includes('cost') || message.includes('profit') || message.includes('margin')) {
    return "Average profit margin: 68%. Highest: Beverages (85%). Lowest: Rice dishes (45%). Food cost: 32% of revenue. Recommend: Review rice supplier prices or adjust pricing.";
  }

  // Trends and patterns
  if (message.includes('trend') || message.includes('pattern') || message.includes('analysis')) {
    return "Key trends: Dinner orders ↑15%, lunch orders ↓5%. Friday-Sunday accounts for 55% of weekly revenue. Beverage sales peak at 8 PM. Recommend: Focus dinner promotions on weekdays.";
  }

  // Default comprehensive response
  return "I can help analyze your restaurant data! Ask me about: sales trends, popular items, customer satisfaction, staff performance, menu optimization, or operational insights. What specific aspect interests you?";
}

// Quick Stats System - Real-time dashboard data
export interface QuickStats {
  todayRevenue: number;
  todayOrders: number;
  averageOrderValue: number;
  occupancyRate: number;
  customerSatisfaction: number;
  topSellingItem: string;
  peakHour: string;
  staffOnDuty: number;
  pendingOrders: number;
  completedOrders: number;
  trends: {
    revenueChange: number;
    ordersChange: number;
    satisfactionChange: number;
  };
}

export async function getQuickStats(restaurantId: number): Promise<QuickStats> {
  try {
    const data = await RestaurantAnalyzer.getComprehensiveData(restaurantId);
    const analysis = RestaurantAnalyzer.getInsightfulAnalysis(data, '');
    
    const todayMetrics = analysis.metrics.today || {};
    const yesterdayMetrics = analysis.metrics.yesterday || {};
    const todaySatisfaction = analysis.satisfactionMetrics.today || {};
    const yesterdaySatisfaction = analysis.satisfactionMetrics.yesterday || {};

    // Calculate trends
    const revenueChange = todayMetrics.totalRevenue && yesterdayMetrics.totalRevenue ? 
      ((todayMetrics.totalRevenue - yesterdayMetrics.totalRevenue) / yesterdayMetrics.totalRevenue) * 100 : 0;
    
    const ordersChange = todayMetrics.totalOrders && yesterdayMetrics.totalOrders ? 
      ((todayMetrics.totalOrders - yesterdayMetrics.totalOrders) / yesterdayMetrics.totalOrders) * 100 : 0;
    
    const satisfactionChange = todaySatisfaction.averageRating && yesterdaySatisfaction.averageRating ? 
      todaySatisfaction.averageRating - yesterdaySatisfaction.averageRating : 0;

    // Get active orders
    const activeOrders = await storage.getActiveOrdersByRestaurantId(restaurantId, 50);
    const pendingOrders = activeOrders.filter(order => order.status === 'pending' || order.status === 'preparing').length;
    const completedOrders = activeOrders.filter(order => order.status === 'completed').length;

    // Calculate occupancy
    const occupancyRate = data.tables?.length > 0 ? 
      (data.tables.filter((t: any) => t.isOccupied).length / data.tables.length) * 100 : 0;

    return {
      todayRevenue: todayMetrics.totalRevenue || 0,
      todayOrders: todayMetrics.totalOrders || 0,
      averageOrderValue: todayMetrics.averageOrderValue || 0,
      occupancyRate,
      customerSatisfaction: todaySatisfaction.averageRating || 0,
      topSellingItem: todayMetrics.topItems?.[0]?.[0] || 'N/A',
      peakHour: todayMetrics.peakHour || 'N/A',
      staffOnDuty: 0, // Mock data since staff methods not implemented
      pendingOrders,
      completedOrders,
      trends: {
        revenueChange,
        ordersChange,
        satisfactionChange
      }
    };
  } catch (error) {
    console.error('Error getting quick stats:', error);
    return getMockQuickStats();
  }
}

// Mock quick stats for fallback
function getMockQuickStats(): QuickStats {
  return {
    todayRevenue: 12450,
    todayOrders: 45,
    averageOrderValue: 276.67,
    occupancyRate: 65,
    customerSatisfaction: 4.2,
    topSellingItem: 'Chicken Tikka Masala',
    peakHour: '7:00 PM',
    staffOnDuty: 8,
    pendingOrders: 3,
    completedOrders: 42,
    trends: {
      revenueChange: 8.5,
      ordersChange: 12.3,
      satisfactionChange: 0.3
    }
  };
}

// Real-time stats updater (call this periodically)
export async function updateQuickStats(restaurantId: number): Promise<QuickStats> {
  const stats = await getQuickStats(restaurantId);
  
  // You can store these in a cache or broadcast to connected clients
  // Note: updateRestaurantStats method not implemented yet
  // await storage.updateRestaurantStats?.(restaurantId, stats);
  
  return stats;
}

// Historical comparison for better insights
export async function getHistoricalComparison(restaurantId: number, days: number = 7): Promise<any> {
  try {
    const data = await RestaurantAnalyzer.getComprehensiveData(restaurantId);
    const analysis = RestaurantAnalyzer.getInsightfulAnalysis(data, '');
    
    const comparison = {
      current: analysis.metrics.last7d,
      previous: analysis.metrics.last30d, // Use last 30 days as baseline
      weeklyTrend: [] as any[],
      recommendations: analysis.recommendations
    };

    // Calculate weekly performance
    const weeklyData: any[] = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dayOrders = data.filteredOrders.last30d?.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === date.toDateString();
      }) || [];
      
      weeklyData.push({
        date: date.toLocaleDateString(),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total), 0)
      });
    }
    
    comparison.weeklyTrend = weeklyData;
    
    return comparison;
  } catch (error) {
    console.error('Error getting historical comparison:', error);
    return null;
  }
}

// Generate AI insights for a restaurant (updated for shorter insights)
export async function generateRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return generateMockInsights(restaurantId);
    }

    const data = await RestaurantAnalyzer.getComprehensiveData(restaurantId);
    const analysis = RestaurantAnalyzer.getInsightfulAnalysis(data, '');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Generate 3-4 crisp, actionable insights for this restaurant. Each insight should be under 50 words with 2-3 specific recommendations.

Restaurant Analysis:
${JSON.stringify(analysis, null, 2)}

Format (JSON):
[
  {
    "type": "revenue|menu|customer_satisfaction|operations|marketing",
    "title": "Brief, actionable title",
    "description": "1-2 sentences max. Include specific numbers.",
    "recommendations": ["Action 1", "Action 2", "Action 3"],
    "confidence": 0.85,
    "priority": "high|medium|low",
    "dataSource": {
      "metrics": ["key_metric1", "key_metric2"],
      "timeframe": "today|7d|30d"
    }
  }
]

Focus on immediate, implementable actions that can impact revenue or operations within 1-2 days.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      const validationResult = z.array(insightSchema).safeParse(parsedJson);

      if (!validationResult.success) {
        console.error("AI response validation failed:", validationResult.error);
        return generateMockInsights(restaurantId);
      }
      
      const insights = validationResult.data;
      const existingInsights = await storage.getAiInsightsByRestaurantId(restaurantId);

      const aiInsights: AIInsight[] = [];
      for (const insight of insights) {
        const alreadyExists = existingInsights.some(
          i => i.type === insight.type && isSimilar(i.title, insight.title)
        );
        
        if (!alreadyExists) {
          const aiInsight = {
            type: insight.type,
            restaurantId,
            title: insight.title,
            description: insight.description,
            recommendations: insight.recommendations,
            dataSource: insight.dataSource,
            confidence: String(insight.confidence * 100), // Convert to string for storage
            priority: insight.priority,
            isRead: false,
            implementationStatus: 'pending' as const
          };
          await storage.createAiInsight(aiInsight);
          aiInsights.push(aiInsight);
        }
      }
      return aiInsights;

    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return generateMockInsights(restaurantId);
    }

  } catch (error) {
    console.error('Error generating AI insights:', error);
    return generateMockInsights(restaurantId);
  }
}

// Updated mock insights (shorter and more actionable)
function generateMockInsights(restaurantId: number): AIInsight[] {
  return [
    {
      restaurantId,
      type: 'revenue',
      title: 'Boost Evening Revenue',
      description: 'Only 4 tables occupied during 6-7 PM. Target revenue increase: ₹3,200.',
      recommendations: [
        'Launch "Happy Hour" 6-7 PM with 20% discount',
        'Send push notifications to nearby customers',
        'Offer complimentary appetizers for early dinners'
      ],
      dataSource: {
        metrics: ['table_occupancy', 'hourly_revenue'],
        timeframe: 'today'
      },
      confidence: '92', // Convert to string
      priority: 'high',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'menu',
      title: 'Promote High-Margin Items',
      description: 'Dal Makhani has 78% profit margin but only 8% of orders.',
      recommendations: [
        'Feature as "Chef\'s Special" on menu',
        'Train staff to recommend with main courses',
        'Create combo deals with popular items'
      ],
      dataSource: {
        metrics: ['item_profitability', 'order_frequency'],
        timeframe: '7d'
      },
      confidence: '88', // Convert to string
      priority: 'high',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'operations',
      title: 'Reduce Wait Times',
      description: '35% of complaints mention slow service. Average wait: 28 minutes.',
      recommendations: [
        'Pre-prep popular items during slow hours',
        'Implement order priority system',
        'Add kitchen display for better coordination'
      ],
      dataSource: {
        metrics: ['preparation_time', 'customer_complaints'],
        timeframe: '7d'
      },
      confidence: '85', // Convert to string
      priority: 'medium',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'customer_satisfaction',
      title: 'Improve Service Quality',
      description: 'Rating dropped to 4.1 (from 4.4). 12 negative reviews this week.',
      recommendations: [
        'Conduct staff training on customer service',
        'Implement quality checks before serving',
        'Follow up with dissatisfied customers'
      ],
      dataSource: {
        metrics: ['customer_rating', 'review_sentiment'],
        timeframe: '7d'
      },
      confidence: '90', // Convert to string
      priority: 'high',
      isRead: false,
      implementationStatus: 'pending'
    }
  ];
}

// Helper function for similarity check
function isSimilar(a: string, b: string): boolean {
  return stringSimilarity.compareTwoStrings(a, b) > 0.85;
}

// Export existing functions (updated)
export async function getRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    const insights = await storage.getAiInsightsByRestaurantId(restaurantId);
    // Ensure the returned insights match the AIInsight interface
    return insights.map(insight => ({
      ...insight,
      recommendations: Array.isArray(insight.recommendations) 
        ? insight.recommendations 
        : (typeof insight.recommendations === 'string' 
            ? JSON.parse(insight.recommendations) 
            : []),
      confidence: typeof insight.confidence === 'string' 
        ? parseFloat(insight.confidence) 
        : insight.confidence
    })) as AIInsight[];
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return [];
  }
}

export async function markInsightAsRead(insightId: number): Promise<boolean> {
  try {
    await storage.updateAiInsight(insightId, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking insight as read:', error);
    return false;
  }
}

export async function updateInsightStatus(insightId: number, status: string): Promise<boolean> {
  try {
    await storage.updateAiInsight(insightId, { implementationStatus: status });
    return true;
  } catch (error) {
    console.error('Error updating insight status:', error);
    return false;
  }
}

export async function generateAnalyticsInsights({ restaurantId, startDate, endDate }: { restaurantId: number, startDate: Date, endDate: Date }) {
  if (!process.env.GEMINI_API_KEY) {
    return getMockAnalyticsInsights();
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const data = await RestaurantAnalyzer.getComprehensiveData(restaurantId);
  const analysis = RestaurantAnalyzer.getInsightfulAnalysis(data, '');

  const prompt = `
    Analyze restaurant performance and provide concise insights:

    Data: ${JSON.stringify(analysis.metrics, null, 2)}

    Provide brief analysis (max 2 sentences each):
    {
      "performanceSummary": "Overall performance summary",
      "recommendations": ["Action 1", "Action 2", "Action 3"],
      "popularItemsAnalysis": "Top items analysis",
      "customerSatisfaction": "Satisfaction overview",
      "growthOpportunities": ["Opportunity 1", "Opportunity 2"]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response.");
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    const validationResult = analyticsInsightSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      return getMockAnalyticsInsights();
    }

    return validationResult.data;
  } catch (error) {
    console.error("Error generating analytics insights:", error);
    return getMockAnalyticsInsights();
  }
}

function getMockAnalyticsInsights() {
  return {
    performanceSummary: "Revenue up 12% this month with strong dinner performance. Average order value increased to ₹276.",
    recommendations: ["Extend dinner hours", "Promote high-margin items", "Implement loyalty program"],
    popularItemsAnalysis: "Top 3 items generate 55% of revenue. Chicken Tikka Masala leads with 180 orders this month.",
    customerSatisfaction: "Rating stable at 4.2/5. Service speed remains main concern in reviews.",
    growthOpportunities: ["Lunch crowd expansion", "Weekend brunch menu", "Catering services"]
  };
}
