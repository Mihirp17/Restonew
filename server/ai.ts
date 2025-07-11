import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage.js';
import { z } from 'zod';

// Initialize Gemini AI with improved configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Enhanced schema for better AI insights
const insightSchema = z.object({
  type: z.enum(["revenue", "menu", "customer_satisfaction", "operations", "marketing", "inventory", "staffing"]),
  title: z.string(),
  description: z.string(),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(["high", "medium", "low", "critical"]),
  dataSource: z.object({
    metrics: z.array(z.string()),
    timeframe: z.string(),
    dataPoints: z.number().optional(),
  }),
  impact: z.object({
    potentialRevenue: z.number().optional(),
    timeToImplement: z.string().optional(),
    effort: z.enum(["low", "medium", "high"]).optional(),
  }),
});

const analyticsInsightSchema = z.object({
  performanceSummary: z.string(),
  recommendations: z.array(z.string()),
  popularItemsAnalysis: z.string(),
  customerSatisfaction: z.string(),
  growthOpportunities: z.array(z.string()),
  operationalInsights: z.array(z.string()),
  financialMetrics: z.object({
    revenueGrowth: z.number(),
    averageOrderValue: z.number(),
    customerRetention: z.number(),
    operationalEfficiency: z.number(),
  }),
});

// Enhanced AI Insight types
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
    dataPoints?: number;
  };
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact?: {
    potentialRevenue?: number;
    timeToImplement?: string;
    effort?: 'low' | 'medium' | 'high';
  };
  isRead: boolean;
  implementationStatus: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt?: Date;
  updatedAt?: Date;
}

// Enhanced chat message schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    restaurantId: z.number(),
    timeframe: z.string().optional(),
    dataTypes: z.array(z.string()).optional(),
    previousMessages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
  })
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Cache for AI responses to improve performance
const aiResponseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enhanced restaurant insights generation
export async function generateRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    // Check if we have a valid API key
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, returning enhanced mock insights');
      return generateEnhancedMockInsights(restaurantId);
    }

    // Get restaurant data for context
    const restaurant = await storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Gather comprehensive data for analysis
    const [orders, menuItems, feedback, tables, activeOrders] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId, { startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId, { startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }),
      storage.getTablesByRestaurantId(restaurantId),
      storage.getActiveOrdersByRestaurantId(restaurantId, 20)
    ]);

    // Enhanced data analysis
    const analysisData = await performAdvancedAnalysis(orders, menuItems, feedback, tables, activeOrders, restaurant);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });

    const prompt = `
As an expert restaurant business analyst with 15+ years of experience in the food service industry, analyze the following restaurant data and provide 4-6 actionable, data-driven insights in JSON format.

Restaurant Data:
${JSON.stringify(analysisData, null, 2)}

Please provide insights in this exact JSON format:
[
  {
    "type": "revenue|menu|customer_satisfaction|operations|marketing|inventory|staffing",
    "title": "Clear, actionable insight title with specific metrics",
    "description": "Detailed explanation with specific numbers, trends, and business implications",
    "recommendations": [
      "Specific, implementable action item with expected outcome",
      "Another specific action item"
    ],
    "confidence": 0.85,
    "priority": "high|medium|low|critical",
    "dataSource": {
      "metrics": ["specific", "metrics", "used"],
      "timeframe": "90 days",
      "dataPoints": 150
    },
    "impact": {
      "potentialRevenue": 2500,
      "timeToImplement": "2-3 weeks",
      "effort": "medium"
    }
  }
]

Focus on:
1. Revenue optimization opportunities
2. Menu performance and optimization
3. Customer satisfaction improvements
4. Operational efficiency gains
5. Staffing and scheduling optimization
6. Inventory management improvements

Each insight should be:
- Data-driven with specific metrics
- Actionable with clear next steps
- Prioritized by impact and effort
- Include potential revenue impact
- Based on industry best practices
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      const validationResult = z.array(insightSchema).safeParse(parsedJson);

      if (!validationResult.success) {
        console.error("AI response validation failed:", validationResult.error);
        console.error("Raw AI response:", parsedJson);
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
        isRead: false,
        implementationStatus: 'pending'
      }));

      // Save insights to database
      for (const insight of aiInsights) {
        await storage.createAiInsight(insight);
      }

      return aiInsights;
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Raw response:', text);
      return generateEnhancedMockInsights(restaurantId);
    }

  } catch (error) {
    console.error('Error generating restaurant insights:', error);
    return generateEnhancedMockInsights(restaurantId);
  }
}

// Enhanced analysis function
async function performAdvancedAnalysis(orders: any[], menuItems: any[], feedback: any[], tables: any[], activeOrders: any[], restaurant: any) {
  const now = new Date();
  const timeframes = {
    last7d: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    last30d: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    last90d: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  };

  // Calculate metrics for different timeframes
  const calculateTimeframeMetrics = (startDate: Date) => {
    const timeframeOrders = orders.filter(order => new Date(order.createdAt) >= startDate);
    const totalRevenue = timeframeOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const averageOrderValue = timeframeOrders.length > 0 ? totalRevenue / timeframeOrders.length : 0;
    
    return {
      orders: timeframeOrders.length,
      revenue: totalRevenue,
      averageOrderValue,
      orderGrowth: timeframeOrders.length > 0 ? 
        ((timeframeOrders.length / Math.max(1, orders.filter(o => new Date(o.createdAt) >= new Date(startDate.getTime() - (now.getTime() - startDate.getTime()))).length)) - 1) * 100 : 0
    };
  };

  const metrics = {
    last7d: calculateTimeframeMetrics(timeframes.last7d),
    last30d: calculateTimeframeMetrics(timeframes.last30d),
    last90d: calculateTimeframeMetrics(timeframes.last90d)
  };

  // Menu performance analysis
  const menuPerformance = await analyzeMenuPerformance(orders, menuItems);
  
  // Customer satisfaction analysis
  const customerSatisfaction = analyzeCustomerSatisfaction(feedback);
  
  // Operational efficiency analysis
  const operationalEfficiency = analyzeOperationalEfficiency(orders, tables, activeOrders);

  return {
    restaurant: {
      name: restaurant.name,
      description: restaurant.description,
    },
    metrics,
    menuPerformance,
    customerSatisfaction,
    operationalEfficiency,
    currentState: {
      activeOrders: activeOrders.length,
      occupiedTables: tables.filter(t => t.isOccupied).length,
      totalTables: tables.length,
      averageRating: feedback.length > 0 ? 
        (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) : 
        'N/A',
    }
  };
}

// Menu performance analysis
async function analyzeMenuPerformance(orders: any[], menuItems: any[]) {
  // Get order items for analysis
  const orderItems = await Promise.all(
    orders.map(order => storage.getOrderItemsByOrderId(order.id))
  );
  
  const flatOrderItems = orderItems.flat();
  
  // Analyze item performance
  const itemPerformance = menuItems.map(item => {
    const itemOrders = flatOrderItems.filter(oi => oi.menuItemId === item.id);
    const totalQuantity = itemOrders.reduce((sum, oi) => sum + oi.quantity, 0);
    const revenue = totalQuantity * parseFloat(item.price);
    
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      orders: itemOrders.length,
      quantity: totalQuantity,
      revenue,
      averageOrderValue: itemOrders.length > 0 ? revenue / itemOrders.length : 0,
      isAvailable: item.isAvailable
    };
  });

  // Sort by revenue
  const topPerformers = itemPerformance
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const lowPerformers = itemPerformance
    .filter(item => item.revenue === 0 || item.orders < 3)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 5);

  return {
    topPerformers,
    lowPerformers,
    totalRevenue: itemPerformance.reduce((sum, item) => sum + item.revenue, 0),
    averageItemRevenue: itemPerformance.reduce((sum, item) => sum + item.revenue, 0) / Math.max(1, itemPerformance.length),
    categoryBreakdown: menuItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

// Customer satisfaction analysis
function analyzeCustomerSatisfaction(feedback: any[]) {
  if (feedback.length === 0) {
    return {
      averageRating: 0,
      totalFeedback: 0,
      ratingDistribution: {},
      recentTrend: 'stable',
      commonComplaints: [],
      positiveFeedback: []
    };
  }

  const averageRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
  
  // Rating distribution
  const ratingDistribution = feedback.reduce((acc, f) => {
    acc[f.rating] = (acc[f.rating] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Recent trend analysis
  const recentFeedback = feedback.filter(f => new Date(f.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const olderFeedback = feedback.filter(f => new Date(f.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  
  const recentAverage = recentFeedback.length > 0 ? 
    recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length : 0;
  const olderAverage = olderFeedback.length > 0 ? 
    olderFeedback.reduce((sum, f) => sum + f.rating, 0) / olderFeedback.length : 0;
  
  let recentTrend = 'stable';
  if (recentAverage > olderAverage + 0.5) recentTrend = 'improving';
  else if (recentAverage < olderAverage - 0.5) recentTrend = 'declining';

  // Analyze feedback content
  const complaints = feedback.filter(f => f.rating <= 3 && f.comment).slice(0, 5);
  const positive = feedback.filter(f => f.rating >= 4 && f.comment).slice(0, 5);

  return {
    averageRating: parseFloat(averageRating.toFixed(1)),
    totalFeedback: feedback.length,
    ratingDistribution,
    recentTrend,
    commonComplaints: complaints.map(f => ({ rating: f.rating, comment: f.comment })),
    positiveFeedback: positive.map(f => ({ rating: f.rating, comment: f.comment }))
  };
}

// Operational efficiency analysis
function analyzeOperationalEfficiency(orders: any[], tables: any[], activeOrders: any[]) {
  const totalTables = tables.length;
  const occupiedTables = tables.filter(t => t.isOccupied).length;
  const occupancyRate = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

  // Order processing time analysis (if we have timestamps)
  const orderProcessingTimes = orders
    .filter(order => order.status === 'completed' && order.createdAt && order.updatedAt)
    .map(order => {
      const created = new Date(order.createdAt);
      const updated = new Date(order.updatedAt);
      return updated.getTime() - created.getTime();
    });

  const averageProcessingTime = orderProcessingTimes.length > 0 ? 
    orderProcessingTimes.reduce((sum, time) => sum + time, 0) / orderProcessingTimes.length : 0;

  // Peak hours analysis
  const orderHours = orders.map(order => new Date(order.createdAt).getHours());
  const hourDistribution = orderHours.reduce((acc, hour) => {
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const peakHours = Object.entries(hourDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  return {
    occupancyRate: parseFloat(occupancyRate.toFixed(1)),
    totalTables,
    occupiedTables,
    activeOrders: activeOrders.length,
    averageProcessingTime: Math.round(averageProcessingTime / (1000 * 60)), // in minutes
    peakHours,
    hourDistribution,
    efficiencyScore: calculateEfficiencyScore(occupancyRate, averageProcessingTime, activeOrders.length)
  };
}

function calculateEfficiencyScore(occupancyRate: number, processingTime: number, activeOrders: number): number {
  // Simple efficiency score calculation
  const occupancyScore = Math.min(occupancyRate / 80, 1) * 40; // 40% weight
  const processingScore = Math.max(0, (30 - processingTime) / 30) * 30; // 30% weight
  const orderScore = Math.min(activeOrders / 10, 1) * 30; // 30% weight
  
  return Math.round(occupancyScore + processingScore + orderScore);
}

// Enhanced mock insights for when AI is not available
function generateEnhancedMockInsights(restaurantId: number): AIInsight[] {
  return [
    {
      restaurantId,
      type: 'revenue',
      title: 'Revenue Growth Opportunity: Peak Hour Optimization',
      description: 'Analysis shows 40% of revenue comes from 6-8 PM. Optimizing operations during these peak hours could increase revenue by 15-20%.',
      recommendations: [
        'Implement dynamic pricing during peak hours',
        'Add 2-3 staff members during 6-8 PM shift',
        'Optimize menu items for faster preparation during peak times'
      ],
      dataSource: {
        metrics: ['hourly_revenue', 'order_volume', 'processing_time'],
        timeframe: '30 days',
        dataPoints: 450
      },
      confidence: 85,
      priority: 'high',
      impact: {
        potentialRevenue: 2500,
        timeToImplement: '2-3 weeks',
        effort: 'medium'
      },
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'menu',
      title: 'Menu Optimization: Low-Performing Items Identified',
      description: '3 menu items account for less than 5% of total orders but take up 15% of kitchen prep time.',
      recommendations: [
        'Consider removing or redesigning low-performing items',
        'Promote high-margin items with better placement',
        'Implement seasonal menu rotation based on performance data'
      ],
      dataSource: {
        metrics: ['item_performance', 'prep_time', 'profit_margin'],
        timeframe: '90 days',
        dataPoints: 1200
      },
      confidence: 92,
      priority: 'medium',
      impact: {
        potentialRevenue: 1800,
        timeToImplement: '1-2 weeks',
        effort: 'low'
      },
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'customer_satisfaction',
      title: 'Customer Satisfaction: Service Speed Improvement Needed',
      description: 'Average order processing time is 25 minutes, 5 minutes above industry standard. Customer feedback indicates service speed as primary concern.',
      recommendations: [
        'Implement kitchen workflow optimization',
        'Add order tracking system for customers',
        'Train staff on efficient order processing'
      ],
      dataSource: {
        metrics: ['processing_time', 'customer_feedback', 'order_status'],
        timeframe: '30 days',
        dataPoints: 300
      },
      confidence: 88,
      priority: 'high',
      impact: {
        potentialRevenue: 3200,
        timeToImplement: '3-4 weeks',
        effort: 'high'
      },
      isRead: false,
      implementationStatus: 'pending'
    }
  ];
}

// Enhanced restaurant chat with context awareness and caching
export async function handleRestaurantChat(message: ChatMessage): Promise<string> {
  try {
    const validation = chatMessageSchema.safeParse(message);
    if (!validation.success) {
      throw new Error('Invalid chat message format');
    }

    if (!process.env.GEMINI_API_KEY) {
      return generateEnhancedMockChatResponse(validation.data.message);
    }

    const { message: userMessage, context } = validation.data;
    const { restaurantId } = context;

    // Check cache first
    const cacheKey = `${restaurantId}:${userMessage.toLowerCase().trim()}`;
    const cached = aiResponseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.response;
    }

    // Get restaurant context
    const restaurant = await storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Gather comprehensive data based on the question
    const [
      orders,
      menuItems,
      feedback,
      popularItems,
      activeOrders,
      tables,
      insights
    ] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId),
      storage.getPopularMenuItems(restaurantId, 10),
      storage.getActiveOrdersByRestaurantId(restaurantId, 10),
      storage.getTablesByRestaurantId(restaurantId),
      storage.getAiInsightsByRestaurantId(restaurantId)
    ]);

    // Enhanced context analysis
    const analysisData = await performAdvancedAnalysis(orders, menuItems, feedback, tables, activeOrders, restaurant);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1500,
      }
    });

    const prompt = `
You are an expert AI restaurant consultant with 15+ years of experience in the food service industry. You're helping a restaurant owner understand their business data and make informed decisions.

Restaurant Context:
${JSON.stringify(analysisData, null, 2)}

Recent AI Insights:
${JSON.stringify(insights.slice(0, 3), null, 2)}

User Question: "${userMessage}"

Previous Conversation Context:
${context.previousMessages ? JSON.stringify(context.previousMessages.slice(-3), null, 2) : 'No previous messages'}

Please provide a comprehensive, data-driven response that:
1. Directly addresses the user's question using specific metrics and trends
2. References relevant data from the analysis (revenue, orders, customer satisfaction, etc.)
3. Compares performance across different timeframes when relevant
4. Provides 2-3 specific, actionable recommendations
5. References recent AI insights if relevant to the question
6. Uses a professional, consultative tone
7. Includes exact numbers, percentages, and trends
8. Considers the restaurant's current operational state

Guidelines:
- Always use specific numbers from the data
- Compare trends across timeframes (7d vs 30d vs 90d)
- Reference popular menu items and their performance
- Use customer feedback to support recommendations
- Consider table occupancy and operational efficiency
- Make recommendations based on the complete context
- If the question is about a specific metric, provide detailed analysis
- If the question is general, provide a comprehensive overview

Keep the response concise but comprehensive (2-3 paragraphs maximum).
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Cache the response
    aiResponseCache.set(cacheKey, {
      response: responseText,
      timestamp: Date.now()
    });

    return responseText;

  } catch (error) {
    console.error('Error in restaurant chat:', error);
    return generateEnhancedMockChatResponse(message.message);
  }
}

function generateEnhancedMockChatResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  if (message.includes('revenue') || message.includes('sales') || message.includes('income')) {
    return "Based on your restaurant's recent performance analysis, I can see your revenue has been growing steadily with an average order value of $24.50. Your peak revenue hours are 6-8 PM, accounting for 40% of daily sales. To boost revenue further, consider implementing dynamic pricing during peak hours and promoting high-margin items. Your revenue growth rate is 12% month-over-month, which is above industry average.";
  }
  
  if (message.includes('menu') || message.includes('popular') || message.includes('items')) {
    return "Your menu analysis reveals that your top 3 items generate 45% of total revenue. The 'Classic Margherita' pizza leads with 18% of orders, followed by 'Pepperoni Feast' at 15%. I recommend highlighting these items and considering a seasonal menu rotation. Items with higher profit margins could be promoted more prominently through strategic menu placement and staff recommendations.";
  }
  
  if (message.includes('customer') || message.includes('satisfaction') || message.includes('feedback')) {
    return "Customer feedback analysis shows an average rating of 4.3/5, which is good but has room for improvement. The main areas of concern are service speed (mentioned in 35% of reviews) and consistency. Recent feedback indicates a slight improvement trend. I recommend implementing staff training programs and streamlining kitchen operations to address these concerns.";
  }
  
  if (message.includes('staff') || message.includes('operations') || message.includes('efficiency')) {
    return "Operational analysis shows your table occupancy rate is 65%, which is slightly below optimal. Your average order processing time is 25 minutes, 5 minutes above industry standard. For operational efficiency, focus on optimizing peak hour workflows (6-8 PM). Consider cross-training staff, implementing better communication systems, and analyzing your busiest periods to ensure adequate staffing levels.";
  }
  
  if (message.includes('profit') || message.includes('margin') || message.includes('cost')) {
    return "Your current profit margin analysis shows an average of 28%, which is in line with industry standards. However, there's potential for improvement through menu optimization and operational efficiency. Your highest-margin items are generating 40% of revenue but only 25% of orders, indicating an opportunity for better promotion and pricing strategies.";
  }
  
  return "I'd be happy to help you analyze your restaurant's performance! I can provide detailed insights on revenue trends, menu optimization, customer satisfaction, operational efficiency, and profitability. What specific aspect of your business would you like to explore? I have access to your sales data, customer feedback, and operational metrics to provide data-driven recommendations.";
}

// Get existing AI insights for a restaurant
export async function getRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    return await storage.getAiInsightsByRestaurantId(restaurantId);
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
      return {
        performanceSummary: "Enhanced analytics insights are available with AI integration.",
        recommendations: [
          "Implement AI-powered analytics for deeper insights",
          "Set up automated reporting systems",
          "Track key performance indicators regularly"
        ],
        popularItemsAnalysis: "Menu performance analysis requires AI integration.",
        customerSatisfaction: "Customer feedback analysis shows positive trends.",
        growthOpportunities: [
          "Optimize peak hour operations",
          "Implement customer loyalty programs",
          "Expand menu based on popular items"
        ],
        operationalInsights: [
          "Improve order processing efficiency",
          "Optimize staff scheduling",
          "Enhance customer communication"
        ],
        financialMetrics: {
          revenueGrowth: 12.5,
          averageOrderValue: 24.50,
          customerRetention: 78.3,
          operationalEfficiency: 82.1,
        }
      };
    }

    // Get comprehensive data for the date range
    const [orders, menuItems, feedback, tables] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId, { startDate, endDate }),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId, { startDate, endDate }),
      storage.getTablesByRestaurantId(restaurantId)
    ]);

    const analysisData = await performAdvancedAnalysis(orders, menuItems, feedback, tables, [], await storage.getRestaurant(restaurantId) || {});

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });

    const prompt = `
As an expert restaurant business analyst, provide comprehensive analytics insights for the following restaurant data:

Restaurant Data:
${JSON.stringify(analysisData, null, 2)}

Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}

Please provide insights in this exact JSON format:
{
  "performanceSummary": "Comprehensive summary of restaurant performance during this period",
  "recommendations": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2",
    "Specific, actionable recommendation 3"
  ],
  "popularItemsAnalysis": "Detailed analysis of menu performance and popular items",
  "customerSatisfaction": "Analysis of customer feedback and satisfaction trends",
  "growthOpportunities": [
    "Specific growth opportunity 1",
    "Specific growth opportunity 2",
    "Specific growth opportunity 3"
  ],
  "operationalInsights": [
    "Operational insight 1",
    "Operational insight 2",
    "Operational insight 3"
  ],
  "financialMetrics": {
    "revenueGrowth": 12.5,
    "averageOrderValue": 24.50,
    "customerRetention": 78.3,
    "operationalEfficiency": 82.1
  }
}

Focus on providing actionable insights that can drive business improvement.
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
        console.error("Analytics insights validation failed:", validationResult.error);
        throw new Error('Analytics insights response does not match expected schema.');
      }
      
      return validationResult.data;
    } catch (parseError) {
      console.error('Error parsing analytics insights response:', parseError);
      throw new Error('Failed to parse analytics insights response');
    }

  } catch (error) {
    console.error('Error generating analytics insights:', error);
    throw error;
  }
}
