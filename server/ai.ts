import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage.js';
import { z } from 'zod';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const insightSchema = z.object({
  type: z.enum(["revenue", "menu", "customer_satisfaction", "operations", "marketing"]),
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
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  implementationStatus: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt?: Date;
  updatedAt?: Date;
}

// Chat message schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.object({
    restaurantId: z.number(),
    timeframe: z.string().optional(),
    dataTypes: z.array(z.string()).optional()
  })
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Generate AI insights for a restaurant
export async function generateRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    // Check if we have a valid API key
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, returning mock insights');
      return generateMockInsights(restaurantId);
    }

    // Get restaurant data for context
    const restaurant = await storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Gather recent data for analysis
    const [orders, menuItems, feedback] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId)
    ]);

    // Get recent orders (last 30 days)
    const recentOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orderDate >= thirtyDaysAgo;
    });

    // Calculate key metrics
    const totalRevenue = recentOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const averageOrderValue = recentOrders.length > 0 ? totalRevenue / recentOrders.length : 0;
    const averageRating = feedback.length > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0;

    // Prepare context for Gemini
    const context = {
      restaurant: {
        name: restaurant.name,
        description: restaurant.description
      },
      metrics: {
        totalOrders: recentOrders.length,
        totalRevenue,
        averageOrderValue,
        averageRating,
        menuItemCount: menuItems.length,
        feedbackCount: feedback.length
      },
      recentFeedback: feedback.slice(-5).map(f => ({
        rating: f.rating,
        comment: f.comment
      })),
      topMenuItems: menuItems.slice(0, 10).map(item => ({
        name: item.name,
        price: item.price,
        category: item.category
      }))
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
As a restaurant business analyst, analyze the following restaurant data and provide 3-5 actionable insights in JSON format.

Restaurant Data:
${JSON.stringify(context, null, 2)}

Please provide insights in this exact JSON format:
[
  {
    "type": "revenue",
    "title": "Clear, actionable insight title",
    "description": "Detailed explanation of the insight and its implications",
    "recommendations": [
      "Specific action item 1",
      "Specific action item 2"
    ],
    "confidence": 0.85,
    "priority": "high",
    "dataSource": {
      "metrics": ["relevant", "metrics", "used"],
      "timeframe": "30 days"
    }
  }
]

Focus on practical, implementable recommendations that can improve the restaurant's performance.
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
        confidence: insight.confidence * 100, // Convert to percentage
        priority: insight.priority,
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
      return generateMockInsights(restaurantId);
    }

  } catch (error) {
    console.error('Error generating AI insights:', error);
    return generateMockInsights(restaurantId);
  }
}

// Generate mock insights when API is not available
function generateMockInsights(restaurantId: number): AIInsight[] {
  return [
    {
      restaurantId,
      type: 'revenue',
      title: 'Peak Hour Revenue Optimization',
      description: 'Analysis shows 65% of daily revenue occurs between 6-8 PM, but kitchen capacity utilization is only at 70% during this period.',
      recommendations: [
        'Introduce pre-order system for peak hours',
        'Offer early bird discounts (5-6 PM) to distribute demand',
        'Consider expanding kitchen staff during peak hours'
      ],
      dataSource: {
        metrics: ['hourly_revenue', 'order_volume', 'preparation_times'],
        timeframe: '30 days'
      },
      confidence: 87,
      priority: 'high',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'menu',
      title: 'Menu Item Performance Analysis',
      description: 'Three menu items account for 45% of orders but have below-average profit margins. High-margin items are underperforming.',
      recommendations: [
        'Create combo deals featuring high-margin items',
        'Redesign menu layout to highlight profitable dishes',
        'Consider seasonal pricing for popular low-margin items'
      ],
      dataSource: {
        metrics: ['item_popularity', 'profit_margins', 'order_frequency'],
        timeframe: '30 days'
      },
      confidence: 92,
      priority: 'high',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'customer_satisfaction',
      title: 'Service Speed Improvement Opportunity',
      description: 'Customer feedback indicates 23% of complaints relate to wait times, particularly for appetizers and beverages.',
      recommendations: [
        'Implement parallel food preparation for appetizers',
        'Install self-service beverage station',
        'Train staff on efficient order sequencing'
      ],
      dataSource: {
        metrics: ['customer_feedback', 'preparation_times', 'table_turnover'],
        timeframe: '30 days'
      },
      confidence: 78,
      priority: 'medium',
      isRead: false,
      implementationStatus: 'pending'
    },
    {
      restaurantId,
      type: 'marketing',
      title: 'Customer Retention Strategy',
      description: 'Only 31% of customers return within 30 days. Implementing a loyalty program could increase retention by an estimated 15-20%.',
      recommendations: [
        'Launch points-based loyalty program',
        'Send personalized follow-up messages after visits',
        'Offer birthday discounts and anniversary rewards'
      ],
      dataSource: {
        metrics: ['return_customer_rate', 'visit_frequency', 'customer_lifetime_value'],
        timeframe: '90 days'
      },
      confidence: 85,
      priority: 'medium',
      isRead: false,
      implementationStatus: 'pending'
    }
  ];
}

// Handle chat interactions with restaurant context
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
    const { restaurantId } = context;

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
      tables
    ] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId),
      storage.getMenuItems(restaurantId),
      storage.getFeedbackByRestaurantId(restaurantId),
      storage.getPopularMenuItems(restaurantId, 10),
      storage.getActiveOrdersByRestaurantId(restaurantId, 10),
      storage.getTablesByRestaurantId(restaurantId)
    ]);

    // Calculate recent metrics with more granular timeframes
    const now = new Date();
    const recentOrders = {
      last24h: orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return orderDate >= yesterday;
      }),
      last7d: orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return orderDate >= lastWeek;
      }),
      last30d: orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      })
    };

    // Calculate metrics for different time periods
    const calculateMetrics = (orders: any[]) => {
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total), 0);
      const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
      return {
        totalOrders: orders.length,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrderValue: averageOrderValue.toFixed(2)
      };
    };

    const metrics = {
      last24h: calculateMetrics(recentOrders.last24h),
      last7d: calculateMetrics(recentOrders.last7d),
      last30d: calculateMetrics(recentOrders.last30d)
    };

    const restaurantContext = {
      restaurant: {
        name: restaurant.name,
        description: restaurant.description,
      },
      currentMetrics: {
        ...metrics.last30d,
        menuItems: menuItems.length,
        averageRating: feedback.length > 0 ? 
          (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) : 
          'N/A',
        activeOrders: activeOrders.length,
        occupiedTables: tables.filter(t => t.isOccupied).length,
        totalTables: tables.length
      },
      metrics,
      popularItems: popularItems.map(item => ({
        name: item.name,
        orderCount: item.count,
        revenue: parseFloat(item.price) * item.count
      })),
      recentFeedback: feedback
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(f => ({
          rating: f.rating,
          comment: f.comment,
          createdAt: f.createdAt
        }))
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an expert AI restaurant consultant helping owners understand their business data and make informed decisions.

Restaurant Context:
${JSON.stringify(restaurantContext, null, 2)}

User Question: "${userMessage}"

Please provide a data-driven response that:
1. Addresses the question using specific metrics and trends
2. Compares data across different timeframes (24h vs 7d vs 30d) when relevant
3. References popular items, customer feedback, and operational metrics
4. Provides 2-3 concrete, actionable recommendations
5. Keeps the response concise but comprehensive (max 3 paragraphs)
6. Uses a professional, consultative tone
7. Includes exact numbers and percentages when discussing metrics

Guidelines:
- Always compare trends across timeframes to identify patterns
- Reference specific menu items and their performance when relevant
- Use customer feedback quotes to support recommendations
- Consider table occupancy and operational efficiency
- Make recommendations based on the complete context

If you need additional data not in the context, specify what metrics would help refine the analysis.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Error in restaurant chat:', error);
    return generateMockChatResponse(message.message);
  }
}

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

export async function generateAnalyticsInsights({ restaurantId, startDate, endDate }: { restaurantId: number, startDate: Date, endDate: Date }) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set, returning mock analytics insights.");
    return {
      performanceSummary: "Mock performance summary.",
      recommendations: ["Mock recommendation 1", "Mock recommendation 2"],
      popularItemsAnalysis: "Mock popular items analysis.",
      customerSatisfaction: "Mock customer satisfaction.",
      growthOpportunities: ["Mock growth opportunity 1"],
    };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const restaurant = await storage.getRestaurant(restaurantId);
  const orders = await storage.getOrdersByRestaurantId(restaurantId, { startDate, endDate });
  const feedback = await storage.getFeedbackByRestaurantId(restaurantId, { startDate, endDate });
  const popularItems = await storage.getPopularMenuItems(restaurantId, 5, { startDate, endDate });

  const totalRevenue = orders.reduce((acc, order) => acc + parseFloat(order.total), 0);
  const averageRating = feedback.length > 0 ? feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length : 0;

  const prompt = `
    Analyze the following restaurant data for ${restaurant?.name} from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.

    Data:
    - Total Revenue: $${totalRevenue.toFixed(2)}
    - Total Orders: ${orders.length}
    - Average Customer Rating: ${averageRating.toFixed(2)}/5
    - Most Popular Items: ${popularItems.map(item => item.name).join(", ")}

    Provide a detailed analysis in this exact JSON format:
    {
      "performanceSummary": "A summary of the restaurant's performance.",
      "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"],
      "popularItemsAnalysis": "Analysis of the most popular items.",
      "customerSatisfaction": "Analysis of customer satisfaction based on ratings.",
      "growthOpportunities": ["Growth opportunity 1", "Growth opportunity 2"]
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
      console.error("AI analytics response validation failed:", validationResult.error);
      throw new Error("AI response does not match the expected schema.");
    }

    return validationResult.data;
  } catch (error) {
    console.error("Error generating analytics insights:", error);
    throw new Error("Failed to generate AI-powered analytics insights.");
  }
}
