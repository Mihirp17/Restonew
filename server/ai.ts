import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage.js';
import { z } from 'zod';
import { aiCache, cacheKeys, withCache } from './cache.js';

// Initialize Gemini AI with optimized configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Enhanced schemas
const insightSchema = z.object({
  type: z.enum(["revenue", "menu", "customer_satisfaction", "operations", "marketing", "staffing", "inventory"]),
  title: z.string(),
  description: z.string(),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(["high", "medium", "low", "critical"]),
  dataSource: z.object({
    metrics: z.array(z.string()),
    timeframe: z.string(),
  }),
  impact: z.string().optional(),
  implementationDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const analyticsInsightSchema = z.object({
  performanceSummary: z.string(),
  recommendations: z.array(z.string()),
  popularItemsAnalysis: z.string(),
  customerSatisfaction: z.string(),
  growthOpportunities: z.array(z.string()),
  operationalEfficiency: z.string().optional(),
  competitiveAnalysis: z.string().optional(),
});

// Enhanced chat message schema with conversation context
const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    restaurantId: z.number(),
    timeframe: z.string().optional(),
    dataTypes: z.array(z.string()).optional(),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.string()
    })).optional(),
    sessionId: z.string().optional(),
    userPreferences: z.object({
      detailLevel: z.enum(['brief', 'detailed', 'technical']).optional(),
      focusAreas: z.array(z.string()).optional(),
      language: z.string().optional()
    }).optional()
  })
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

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
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact?: string;
  implementationDifficulty?: 'easy' | 'medium' | 'hard';
  isRead: boolean;
  implementationStatus: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt?: Date;
  updatedAt?: Date;
}

// Conversation session management
interface ConversationSession {
  sessionId: string;
  restaurantId: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  context: {
    lastQueryType: string;
    userPreferences: {
      detailLevel: 'brief' | 'detailed' | 'technical';
      focusAreas: string[];
      language: string;
    };
    restaurantContext: any;
  };
  createdAt: Date;
  lastActivity: Date;
}

// In-memory conversation sessions (in production, use Redis or database)
const conversationSessions = new Map<string, ConversationSession>();

// Generate AI insights for a restaurant with enhanced analysis
export async function generateRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    // Check if we have a valid API key
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, returning mock insights');
      return generateMockInsights(restaurantId);
    }

    // Use cache for restaurant data
    const restaurant = await withCache(
      aiCache,
      cacheKeys.aiInsights(restaurantId),
      async () => {
        const data = await storage.getRestaurant(restaurantId);
        if (!data) throw new Error('Restaurant not found');
        return data;
      }
    );

    // Gather comprehensive data for analysis
    const [orders, menuItems, feedback, tableSessions, bills] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId),
      storage.getTableSessionsByRestaurantId(restaurantId),
      storage.getBillsByRestaurantId(restaurantId)
    ]);

    // Enhanced data analysis
    const analysis = analyzeRestaurantData(orders, menuItems, feedback, tableSessions, bills);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });

    const prompt = `
As an expert restaurant business analyst with 15+ years of experience, provide 5-7 actionable insights for this restaurant.

Restaurant: ${restaurant.name}
${restaurant.description ? `Description: ${restaurant.description}` : ''}

Data Analysis:
${JSON.stringify(analysis, null, 2)}

Provide insights in this exact JSON format:
[
  {
    "type": "revenue|menu|customer_satisfaction|operations|marketing|staffing|inventory",
    "title": "Clear, actionable insight title",
    "description": "Detailed explanation with specific metrics and trends",
    "recommendations": [
      "Specific, implementable action item 1",
      "Specific, implementable action item 2"
    ],
    "confidence": 0.85,
    "priority": "high|medium|low|critical",
    "impact": "Expected impact on business metrics",
    "implementationDifficulty": "easy|medium|hard",
    "dataSource": {
      "metrics": ["relevant", "metrics", "used"],
      "timeframe": "30 days"
    }
  }
]

Focus on:
- Revenue optimization opportunities
- Menu performance and optimization
- Customer satisfaction improvements
- Operational efficiency gains
- Staffing and scheduling optimization
- Inventory management improvements
- Marketing and promotion strategies

Make recommendations specific, measurable, and immediately actionable.
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
        throw new Error('AI response does not match expected schema.');
      }
      
      const insights = validationResult.data;
      
      // Convert to our format and save to database
      const aiInsights: AIInsight[] = insights.map((insight: any) => ({
        restaurantId,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        recommendations: insight.recommendations,
        dataSource: insight.dataSource,
        confidence: insight.confidence * 100,
        priority: insight.priority,
        impact: insight.impact,
        implementationDifficulty: insight.implementationDifficulty,
        isRead: false,
        implementationStatus: 'pending'
      }));

      // Save insights to database
      for (const insight of aiInsights) {
        await storage.createAiInsight(insight);
      }

      // Invalidate cache
      aiCache.delete(cacheKeys.aiInsights(restaurantId));

      return aiInsights;
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Raw response:', text);
      return generateMockInsights(restaurantId);
    }

  } catch (error) {
    console.error('Error generating restaurant insights:', error);
    return generateMockInsights(restaurantId);
  }
}

// Enhanced restaurant data analysis
function analyzeRestaurantData(orders: any[], menuItems: any[], feedback: any[], tableSessions: any[], bills: any[]) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentOrders = orders.filter(order => new Date(order.createdAt) >= thirtyDaysAgo);
  const recentFeedback = feedback.filter(f => new Date(f.createdAt) >= thirtyDaysAgo);
  const recentSessions = tableSessions.filter(s => new Date(s.startTime) >= thirtyDaysAgo);

  // Revenue analysis
  const totalRevenue = recentOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
  const averageOrderValue = recentOrders.length > 0 ? totalRevenue / recentOrders.length : 0;
  const revenueByDay = groupByDay(recentOrders, 'total');
  
  // Menu analysis
  const menuPerformance = analyzeMenuPerformance(recentOrders, menuItems);
  
  // Customer satisfaction
  const averageRating = recentFeedback.length > 0 ? 
    recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length : 0;
  const ratingDistribution = analyzeRatingDistribution(recentFeedback);
  
  // Operations analysis
  const operationalMetrics = analyzeOperations(recentSessions, recentOrders);
  
  // Table utilization
  const tableUtilization = analyzeTableUtilization(recentSessions);
  
  // Payment analysis
  const paymentMetrics = analyzePaymentPatterns(bills);

  return {
    revenue: {
      total: totalRevenue,
      average: averageOrderValue,
      dailyTrend: revenueByDay,
      growthRate: calculateGrowthRate(revenueByDay)
    },
    menu: menuPerformance,
    customerSatisfaction: {
      averageRating,
      ratingDistribution,
      feedbackCount: recentFeedback.length,
      sentiment: analyzeSentiment(recentFeedback)
    },
    operations: operationalMetrics,
    tableUtilization,
    payments: paymentMetrics,
    trends: {
      peakHours: findPeakHours(recentOrders),
      popularDays: findPopularDays(recentOrders),
      seasonalPatterns: detectSeasonalPatterns(recentOrders)
    }
  };
}

// Helper functions for data analysis
function groupByDay(data: any[], valueKey: string) {
  const grouped = new Map();
  data.forEach(item => {
    const date = new Date(item.createdAt).toDateString();
    const value = parseFloat(item[valueKey]);
    grouped.set(date, (grouped.get(date) || 0) + value);
  });
  return Object.fromEntries(grouped);
}

function analyzeMenuPerformance(orders: any[], menuItems: any[]) {
  const itemCounts = new Map();
  const itemRevenue = new Map();
  
  orders.forEach(order => {
    // This would need to be expanded to include order items
    // For now, using mock data
  });
  
  return {
    topPerformers: Array.from(itemCounts.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 10),
    revenueLeaders: Array.from(itemRevenue.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 10)
  };
}

function analyzeRatingDistribution(feedback: any[]) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  feedback.forEach(f => {
    distribution[f.rating as keyof typeof distribution]++;
  });
  return distribution;
}

function analyzeOperations(sessions: any[], orders: any[]) {
  const avgSessionDuration = sessions.length > 0 ? 
    sessions.reduce((sum, s) => {
      if (s.endTime) {
        return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
      }
      return sum;
    }, 0) / sessions.length : 0;
    
  return {
    averageSessionDuration: avgSessionDuration / (1000 * 60), // in minutes
    orderProcessingTime: calculateOrderProcessingTime(orders),
    tableTurnoverRate: calculateTableTurnover(sessions)
  };
}

function analyzeTableUtilization(sessions: any[]) {
  // Mock implementation - would need actual table data
  return {
    averageUtilization: 0.75,
    peakUtilization: 0.95,
    lowUtilizationPeriods: ['2-4 PM', '9-11 PM']
  };
}

function analyzePaymentPatterns(bills: any[]) {
  const paymentMethods = new Map();
  const averageBillValue = bills.length > 0 ? 
    bills.reduce((sum, bill) => sum + parseFloat(bill.total), 0) / bills.length : 0;
    
  return {
    averageBillValue,
    paymentMethodDistribution: Object.fromEntries(paymentMethods),
    tipPercentage: calculateAverageTip(bills)
  };
}

function calculateGrowthRate(dailyData: any) {
  const values = Object.values(dailyData);
  if (values.length < 2) return 0;
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
}

function analyzeSentiment(feedback: any[]) {
  const positive = feedback.filter(f => f.rating >= 4).length;
  const neutral = feedback.filter(f => f.rating === 3).length;
  const negative = feedback.filter(f => f.rating <= 2).length;
  
  return {
    positive: (positive / feedback.length) * 100,
    neutral: (neutral / feedback.length) * 100,
    negative: (negative / feedback.length) * 100
  };
}

function findPeakHours(orders: any[]) {
  const hourCounts = new Array(24).fill(0);
  orders.forEach(order => {
    const hour = new Date(order.createdAt).getHours();
    hourCounts[hour]++;
  });
  
  const maxCount = Math.max(...hourCounts);
  return hourCounts.map((count, hour) => ({ hour, count }))
    .filter(h => h.count === maxCount)
    .map(h => `${h.hour}:00`);
}

function findPopularDays(orders: any[]) {
  const dayCounts = new Array(7).fill(0);
  orders.forEach(order => {
    const day = new Date(order.createdAt).getDay();
    dayCounts[day]++;
  });
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayCounts.map((count, day) => ({ day: dayNames[day], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(d => d.day);
}

function detectSeasonalPatterns(orders: any[]) {
  // Mock implementation - would need more historical data
  return {
    weeklyPattern: 'Weekend peak',
    monthlyPattern: 'End of month increase',
    seasonalTrend: 'Summer decline'
  };
}

function calculateOrderProcessingTime(orders: any[]) {
  // Mock implementation
  return 15; // minutes
}

function calculateTableTurnover(sessions: any[]) {
  // Mock implementation
  return 2.5; // turnovers per day
}

function calculateAverageTip(bills: any[]) {
  const billsWithTips = bills.filter(bill => parseFloat(bill.tip) > 0);
  return billsWithTips.length > 0 ? 
    billsWithTips.reduce((sum, bill) => sum + parseFloat(bill.tip), 0) / billsWithTips.length : 0;
}

// Enhanced restaurant chat with conversation history and personalization
export async function handleRestaurantChat(message: ChatMessage): Promise<string> {
  try {
    const validation = chatMessageSchema.safeParse(message);
    if (!validation.success) {
      throw new Error('Invalid chat message format');
    }

    if (!process.env.GEMINI_API_KEY) {
      return generateMockChatResponse(validation.data.message);
    }

    const { message: userMessage, context } = validation.data;
    const { restaurantId, sessionId, conversationHistory, userPreferences } = context;

    // Get or create conversation session
    const session = getOrCreateSession(sessionId || 'default', restaurantId, userPreferences);
    
    // Add user message to session
    session.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // Get restaurant context with caching
    const restaurantContext = await getRestaurantContext(restaurantId);

    // Analyze user intent and preferences
    const intent = analyzeUserIntent(userMessage);
    updateUserPreferences(session, intent, userMessage);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1500,
      }
    });

    // Build conversation context
    const conversationContext = buildConversationContext(session, restaurantContext, intent);

    const prompt = `
You are an expert AI restaurant consultant with deep knowledge of restaurant operations, analytics, and business optimization.

Restaurant Context:
${JSON.stringify(restaurantContext, null, 2)}

Conversation History (last 5 messages):
${session.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

User Intent Analysis:
- Query Type: ${intent.type}
- Focus Areas: ${intent.focusAreas.join(', ')}
- Detail Level: ${session.context.userPreferences.detailLevel}
- Language: ${session.context.userPreferences.language}

Current Question: "${userMessage}"

Provide a response that:
1. Addresses the specific question using relevant data and metrics
2. Maintains conversation context and builds on previous interactions
3. Adapts to the user's preferred detail level (${session.context.userPreferences.detailLevel})
4. Focuses on the user's areas of interest: ${session.context.userPreferences.focusAreas.join(', ')}
5. Provides actionable, specific recommendations
6. Uses a professional but conversational tone
7. References specific numbers and trends when relevant
8. Suggests follow-up questions or related topics

Guidelines:
- Be specific and data-driven
- Provide concrete, implementable advice
- Consider the restaurant's current performance context
- Adapt language complexity based on user preferences
- Include relevant comparisons and benchmarks
- Suggest next steps or related areas to explore

Response should be ${session.context.userPreferences.detailLevel === 'brief' ? 'concise (2-3 sentences)' : 
  session.context.userPreferences.detailLevel === 'detailed' ? 'comprehensive (3-4 paragraphs)' : 
  'technical and detailed (4-5 paragraphs with specific metrics)'}.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text();

    // Add AI response to session
    session.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    });

    // Update session context
    session.context.lastQueryType = intent.type;
    session.lastActivity = new Date();

    // Limit conversation history to last 20 messages
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    return aiResponse;

  } catch (error) {
    console.error('Error in restaurant chat:', error);
    return generateMockChatResponse(message.message);
  }
}

// Session management functions
function getOrCreateSession(sessionId: string, restaurantId: number, userPreferences?: any): ConversationSession {
  if (conversationSessions.has(sessionId)) {
    const session = conversationSessions.get(sessionId)!;
    session.lastActivity = new Date();
    return session;
  }

  const newSession: ConversationSession = {
    sessionId,
    restaurantId,
    messages: [],
    context: {
      lastQueryType: 'general',
      userPreferences: {
        detailLevel: userPreferences?.detailLevel || 'detailed',
        focusAreas: userPreferences?.focusAreas || ['revenue', 'operations', 'customer_satisfaction'],
        language: userPreferences?.language || 'en'
      },
      restaurantContext: null
    },
    createdAt: new Date(),
    lastActivity: new Date()
  };

  conversationSessions.set(sessionId, newSession);
  return newSession;
}

async function getRestaurantContext(restaurantId: number) {
  return await withCache(
    aiCache,
    `restaurant_context:${restaurantId}`,
    async () => {
      const [restaurant, orders, menuItems, feedback, tableSessions] = await Promise.all([
        storage.getRestaurant(restaurantId),
        storage.getOrdersByRestaurantId(restaurantId),
        storage.getMenuItems(restaurantId),
        storage.getFeedbackByRestaurantId(restaurantId),
        storage.getTableSessionsByRestaurantId(restaurantId)
      ]);

      return {
        restaurant: {
          name: restaurant?.name,
          description: restaurant?.description
        },
        metrics: calculateCurrentMetrics(orders, menuItems, feedback, tableSessions),
        recentActivity: getRecentActivity(orders, feedback, tableSessions)
      };
    },
    1000 * 60 * 5 // 5 minutes cache
  );
}

function calculateCurrentMetrics(orders: any[], menuItems: any[], feedback: any[], tableSessions: any[]) {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentOrders = orders.filter(o => new Date(o.createdAt) >= last30Days);
  const recentFeedback = feedback.filter(f => new Date(f.createdAt) >= last30Days);
  
  return {
    totalOrders: recentOrders.length,
    totalRevenue: recentOrders.reduce((sum, o) => sum + parseFloat(o.total), 0),
    averageOrderValue: recentOrders.length > 0 ? 
      recentOrders.reduce((sum, o) => sum + parseFloat(o.total), 0) / recentOrders.length : 0,
    averageRating: recentFeedback.length > 0 ? 
      recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length : 0,
    activeTables: tableSessions.filter(s => s.status === 'active').length,
    menuItems: menuItems.length
  };
}

function getRecentActivity(orders: any[], feedback: any[], tableSessions: any[]) {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  return {
    recentOrders: orders.filter(o => new Date(o.createdAt) >= last7Days).length,
    recentFeedback: feedback.filter(f => new Date(f.createdAt) >= last7Days).length,
    activeSessions: tableSessions.filter(s => s.status === 'active').length
  };
}

function analyzeUserIntent(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const intentTypes = {
    revenue: ['revenue', 'sales', 'income', 'profit', 'earnings', 'money'],
    menu: ['menu', 'food', 'items', 'dishes', 'popular', 'best selling'],
    operations: ['operations', 'efficiency', 'staff', 'service', 'speed', 'wait time'],
    customers: ['customers', 'satisfaction', 'feedback', 'reviews', 'ratings'],
    analytics: ['analytics', 'data', 'trends', 'performance', 'metrics'],
    general: ['help', 'advice', 'suggestions', 'improve', 'optimize']
  };

  let detectedType = 'general';
  let maxMatches = 0;

  for (const [type, keywords] of Object.entries(intentTypes)) {
    const matches = keywords.filter(keyword => lowerMessage.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedType = type;
    }
  }

  return {
    type: detectedType,
    focusAreas: [detectedType],
    confidence: maxMatches / Math.max(...Object.values(intentTypes).map(k => k.length))
  };
}

function updateUserPreferences(session: ConversationSession, intent: any, message: string) {
  // Update focus areas based on current query
  if (!session.context.userPreferences.focusAreas.includes(intent.type)) {
    session.context.userPreferences.focusAreas.push(intent.type);
    // Keep only top 5 focus areas
    session.context.userPreferences.focusAreas = session.context.userPreferences.focusAreas.slice(-5);
  }

  // Detect detail level preference
  if (message.includes('brief') || message.includes('short') || message.includes('quick')) {
    session.context.userPreferences.detailLevel = 'brief';
  } else if (message.includes('detailed') || message.includes('comprehensive') || message.includes('full')) {
    session.context.userPreferences.detailLevel = 'detailed';
  } else if (message.includes('technical') || message.includes('data') || message.includes('metrics')) {
    session.context.userPreferences.detailLevel = 'technical';
  }
}

function buildConversationContext(session: ConversationSession, restaurantContext: any, intent: any) {
  return {
    restaurant: restaurantContext.restaurant,
    currentMetrics: restaurantContext.metrics,
    recentActivity: restaurantContext.recentActivity,
    userPreferences: session.context.userPreferences,
    conversationHistory: session.messages.slice(-3), // Last 3 messages for context
    intent: intent
  };
}

// Enhanced mock chat response
function generateMockChatResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  if (message.includes('revenue') || message.includes('sales')) {
    return "Based on your restaurant's recent performance, I can see your revenue has been steady with an average order value of $24.50. To boost revenue, consider implementing upselling strategies like combo meals or dessert promotions. Your peak hours are 6-8 PM, so optimizing operations during this time could significantly impact your bottom line.";
  }
  
  if (message.includes('menu') || message.includes('popular') || message.includes('items')) {
    return "Your menu analysis shows that certain items are driving most of your orders. I'd recommend highlighting your top-performing dishes and considering seasonal variations. Items with higher profit margins could be promoted more prominently through strategic menu placement and staff recommendations.";
  }
  
  if (message.includes('customer') || message.includes('satisfaction') || message.includes('feedback')) {
    return "Customer feedback indicates generally positive experiences with an average rating of 4.3/5. The main areas for improvement seem to be service speed and consistency. Implementing staff training programs and streamlining kitchen operations could help address these concerns and boost satisfaction scores.";
  }
  
  if (message.includes('staff') || message.includes('operations')) {
    return "For operational efficiency, focus on optimizing your peak hour workflows. Consider cross-training staff, implementing better communication systems between front-of-house and kitchen, and analyzing your busiest periods to ensure adequate staffing levels.";
  }
  
  return "I'd be happy to help you analyze your restaurant's performance! I can provide insights on revenue trends, menu optimization, customer satisfaction, and operational efficiency. What specific aspect of your business would you like to explore? For more detailed analysis, I can examine your sales data, customer feedback, and operational metrics.";
}

// Get existing AI insights for a restaurant
export async function getRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    return await withCache(
      aiCache,
      cacheKeys.aiInsights(restaurantId),
      () => storage.getAiInsightsByRestaurantId(restaurantId)
    );
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return [];
  }
}

// Mark insight as read
export async function markInsightAsRead(insightId: number): Promise<boolean> {
  try {
    await storage.updateAiInsight(insightId, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking insight as read:', error);
    return false;
  }
}

// Update insight implementation status
export async function updateInsightStatus(insightId: number, status: string): Promise<boolean> {
  try {
    await storage.updateAiInsight(insightId, { implementationStatus: status });
    return true;
  } catch (error) {
    console.error('Error updating insight status:', error);
    return false;
  }
}

// Enhanced analytics insights generation
export async function generateAnalyticsInsights({ restaurantId, startDate, endDate }: { restaurantId: number, startDate: Date, endDate: Date }) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return generateMockAnalyticsInsights();
    }

    const [orders, menuItems, feedback, tableSessions] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId, { startDate, endDate }),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId, { startDate, endDate }),
      storage.getTableSessionsByRestaurantId(restaurantId)
    ]);

    const analysis = analyzeRestaurantData(orders, menuItems, feedback, tableSessions, []);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Analyze this restaurant data and provide comprehensive analytics insights.

Data Analysis:
${JSON.stringify(analysis, null, 2)}

Provide insights in this exact JSON format:
{
  "performanceSummary": "Overall performance summary with key metrics",
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2",
    "Specific recommendation 3"
  ],
  "popularItemsAnalysis": "Analysis of menu performance and popular items",
  "customerSatisfaction": "Customer satisfaction analysis and trends",
  "growthOpportunities": [
    "Growth opportunity 1",
    "Growth opportunity 2"
  ],
  "operationalEfficiency": "Operational efficiency analysis and improvements",
  "competitiveAnalysis": "Competitive positioning and market analysis"
}

Focus on actionable insights and specific recommendations.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      const validationResult = analyticsInsightSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        console.error("Analytics AI response validation failed:", validationResult.error);
        throw new Error('AI response does not match expected schema.');
      }

      return validationResult.data;
    } catch (parseError) {
      console.error('Error parsing analytics response:', parseError);
      return generateMockAnalyticsInsights();
    }

  } catch (error) {
    console.error('Error generating analytics insights:', error);
    return generateMockAnalyticsInsights();
  }
}

function generateMockAnalyticsInsights() {
  return {
    performanceSummary: "Your restaurant shows strong performance with consistent revenue growth and high customer satisfaction scores.",
    recommendations: [
      "Implement dynamic pricing during peak hours to maximize revenue",
      "Introduce a loyalty program to increase customer retention",
      "Optimize menu based on profitability analysis"
    ],
    popularItemsAnalysis: "Your signature dishes are performing exceptionally well, contributing to 60% of total revenue.",
    customerSatisfaction: "Customer satisfaction remains high at 4.3/5, with service speed being the main area for improvement.",
    growthOpportunities: [
      "Expand delivery service to capture more market share",
      "Introduce seasonal menu items to attract new customers"
    ],
    operationalEfficiency: "Table turnover rate is optimal, but kitchen efficiency could be improved during peak hours.",
    competitiveAnalysis: "Your restaurant is well-positioned in the market with strong differentiation in service quality."
  };
}

// Enhanced mock insights with more variety
function generateMockInsights(restaurantId: number): AIInsight[] {
  return [
    {
      restaurantId,
      type: "revenue",
      title: "Peak Hour Revenue Optimization Opportunity",
      description: "Analysis shows 40% higher revenue potential during 6-8 PM peak hours. Current utilization is at 75% capacity.",
      recommendations: [
        "Implement dynamic pricing during peak hours",
        "Add 2-3 high-margin appetizer options",
        "Train staff on upselling techniques"
      ],
      confidence: 85,
      priority: "high",
      impact: "Potential 15-20% revenue increase during peak hours",
      implementationDifficulty: "medium",
      dataSource: {
        metrics: ["hourly_revenue", "table_utilization", "average_order_value"],
        timeframe: "30 days"
      },
      isRead: false,
      implementationStatus: "pending"
    },
    {
      restaurantId,
      type: "menu",
      title: "Menu Performance Optimization",
      description: "Top 3 menu items generate 65% of revenue. 4 items show declining popularity and should be reviewed.",
      recommendations: [
        "Promote top-performing items more prominently",
        "Review and potentially remove low-performing items",
        "Introduce seasonal variations of popular dishes"
      ],
      confidence: 92,
      priority: "medium",
      impact: "Potential 10-15% increase in average order value",
      implementationDifficulty: "easy",
      dataSource: {
        metrics: ["item_sales", "revenue_per_item", "customer_preferences"],
        timeframe: "30 days"
      },
      isRead: false,
      implementationStatus: "pending"
    },
    {
      restaurantId,
      type: "customer_satisfaction",
      title: "Service Speed Improvement Needed",
      description: "Customer feedback indicates 25% of complaints relate to service speed. Average wait time is 18 minutes.",
      recommendations: [
        "Implement kitchen display system for better order tracking",
        "Cross-train staff for flexible deployment",
        "Optimize table layout for better service flow"
      ],
      confidence: 78,
      priority: "high",
      impact: "Expected 0.5 point improvement in customer ratings",
      implementationDifficulty: "medium",
      dataSource: {
        metrics: ["service_time", "customer_ratings", "complaint_analysis"],
        timeframe: "30 days"
      },
      isRead: false,
      implementationStatus: "pending"
    }
  ];
}
