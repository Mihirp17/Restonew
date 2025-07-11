import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage';
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
  type: 'performance' | 'menu' | 'customer' | 'revenue' | 'operational' | 'marketing';
  title: string;
  description: string;
  recommendations: string[];
  dataSource: {
    metric: string;
    value: number | string;
    period: string;
    comparison?: string;
  };
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  implementation: {
    difficulty: 'easy' | 'medium' | 'hard';
    timeframe: string;
    estimatedImpact: string;
  };
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

// Enhanced restaurant insights generation with real data
export async function generateRestaurantInsights(restaurantId: number): Promise<AIInsight[]> {
  try {
    console.log(`Generating AI insights for restaurant ${restaurantId}`);

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured, returning enhanced insights based on real data');
      return await generateDataDrivenInsights(restaurantId);
    }

    // Get real restaurant data for analysis
    const restaurantData = await gatherRestaurantData(restaurantId);
    
    if (!restaurantData.hasData) {
      console.log('No sufficient data available, returning starter insights');
      return generateStarterInsights(restaurantId);
    }

    // Generate AI insights using Gemini with real data
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const prompt = `
      Analyze this restaurant's performance data and provide actionable business insights:

      Restaurant Data:
      - Total Orders (last 30 days): ${restaurantData.totalOrders}
      - Revenue (last 30 days): $${restaurantData.revenue}
      - Average Order Value: $${restaurantData.averageOrderValue}
      - Most Popular Items: ${restaurantData.popularItems.map(item => `${item.name} (${item.count} orders)`).join(', ')}
      - Active Tables: ${restaurantData.activeTables}/${restaurantData.totalTables}
      - Peak Hours: ${restaurantData.peakHours || 'Not enough data'}
      - Customer Feedback Average: ${restaurantData.avgRating || 'No feedback yet'}/5
      - Session Duration Average: ${restaurantData.avgSessionDuration || 'N/A'} minutes

      Please provide 3-5 specific, actionable insights in JSON format with this structure:
      {
        "insights": [
          {
            "type": "performance|menu|customer|revenue|operational|marketing",
            "title": "Brief insight title",
            "description": "Detailed analysis of the issue or opportunity",
            "recommendations": ["Specific action 1", "Specific action 2"],
            "dataSource": {
              "metric": "Source metric name",
              "value": "actual value from data",
              "period": "last 30 days"
            },
            "confidence": 85,
            "priority": "high|medium|low",
            "implementation": {
              "difficulty": "easy|medium|hard",
              "timeframe": "1-2 weeks",
              "estimatedImpact": "Expected outcome"
            }
          }
        ]
      }

      Focus on actionable insights that can improve revenue, customer satisfaction, or operational efficiency.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      // Clean the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const insights = JSON.parse(jsonMatch[0]);
      const aiInsights: AIInsight[] = insights.insights.map((insight: any) => ({
        ...insight,
        confidence: Math.min(100, Math.max(0, insight.confidence || 75))
      }));

      // Store insights in database
      for (const insight of aiInsights) {
        await storage.createAiInsight({
          restaurantId,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          recommendations: insight.recommendations,
          dataSource: insight.dataSource,
          confidence: insight.confidence.toString(),
          priority: insight.priority,
          isRead: false,
          implementationStatus: 'pending'
        });
      }

      return aiInsights;
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.log('Raw response:', text);
      // Fallback to data-driven insights
      return await generateDataDrivenInsights(restaurantId);
    }

  } catch (error) {
    console.error('Error generating AI insights:', error);
    // Fallback to data-driven insights if AI fails
    return await generateDataDrivenInsights(restaurantId);
  }
}

// Gather real restaurant data for analysis
async function gatherRestaurantData(restaurantId: number) {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const [
      totalOrders,
      revenue,
      averageOrderValue,
      popularItems,
      tables,
      restaurant
    ] = await Promise.all([
      storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate),
      storage.getRestaurantRevenue(restaurantId, startDate, endDate),
      storage.getAverageOrderValue(restaurantId, startDate, endDate),
      storage.getPopularMenuItems(restaurantId, 5, { startDate, endDate }),
      storage.getTablesByRestaurantId(restaurantId),
      storage.getRestaurant(restaurantId)
    ]);

    const activeTables = tables.filter(table => table.isOccupied).length;

    return {
      hasData: totalOrders > 0,
      totalOrders,
      revenue,
      averageOrderValue,
      popularItems,
      activeTables,
      totalTables: tables.length,
      restaurant,
      // Additional metrics could be calculated here
      peakHours: null, // Would need order time analysis
      avgRating: null, // Would need feedback data
      avgSessionDuration: null // Would need session analysis
    };
  } catch (error) {
    console.error('Error gathering restaurant data:', error);
    return { hasData: false };
  }
}

// Generate data-driven insights when AI is not available
async function generateDataDrivenInsights(restaurantId: number): Promise<AIInsight[]> {
  const restaurantData = await gatherRestaurantData(restaurantId);
  const insights: AIInsight[] = [];

  if (!restaurantData.hasData) {
    return generateStarterInsights(restaurantId);
  }

  // Revenue Performance Insight
  if (restaurantData.revenue < 1000) {
    insights.push({
      type: 'revenue',
      title: 'Revenue Growth Opportunity',
      description: `Current monthly revenue of $${restaurantData.revenue.toFixed(2)} shows significant growth potential. Focus on increasing order frequency and average order value.`,
      recommendations: [
        'Implement upselling strategies for popular items',
        'Create combo meals to increase average order value',
        'Run targeted promotions during slow periods',
        'Focus on customer retention programs'
      ],
      dataSource: {
        metric: 'Monthly Revenue',
        value: `$${restaurantData.revenue.toFixed(2)}`,
        period: 'last 30 days'
      },
      confidence: 85,
      priority: 'high',
      implementation: {
        difficulty: 'medium',
        timeframe: '2-4 weeks',
        estimatedImpact: '15-25% revenue increase'
      }
    });
  }

  // Order Volume Insight
  if (restaurantData.totalOrders < 50) {
    insights.push({
      type: 'marketing',
      title: 'Customer Acquisition Needed',
      description: `With ${restaurantData.totalOrders} orders in 30 days, focus on attracting more customers through digital marketing and word-of-mouth.`,
      recommendations: [
        'Set up social media presence',
        'Implement referral programs',
        'Partner with local delivery platforms',
        'Create loyalty rewards for repeat customers'
      ],
      dataSource: {
        metric: 'Total Orders',
        value: restaurantData.totalOrders,
        period: 'last 30 days'
      },
      confidence: 90,
      priority: 'high',
      implementation: {
        difficulty: 'medium',
        timeframe: '1-3 weeks',
        estimatedImpact: '30-50% increase in customer base'
      }
    });
  }

  // Menu Optimization Insight
  if (restaurantData.popularItems.length > 0) {
    const topItem = restaurantData.popularItems[0];
    insights.push({
      type: 'menu',
      title: 'Menu Optimization Opportunity',
      description: `${topItem.name} is your top performer with ${topItem.count} orders. Leverage this success to optimize your menu mix.`,
      recommendations: [
        `Create variations of ${topItem.name}`,
        'Prominently feature popular items in QR menu',
        'Bundle popular items with complementary dishes',
        'Analyze why this item performs well and apply learnings to other dishes'
      ],
      dataSource: {
        metric: 'Most Popular Item',
        value: `${topItem.name} (${topItem.count} orders)`,
        period: 'last 30 days'
      },
      confidence: 80,
      priority: 'medium',
      implementation: {
        difficulty: 'easy',
        timeframe: '1-2 weeks',
        estimatedImpact: '10-20% increase in average order value'
      }
    });
  }

  // Table Utilization Insight
  const utilizationRate = (restaurantData.activeTables / restaurantData.totalTables) * 100;
  if (utilizationRate < 50) {
    insights.push({
      type: 'operational',
      title: 'Table Utilization Optimization',
      description: `Current table utilization is ${utilizationRate.toFixed(1)}%. Improve table turnover and occupancy rates.`,
      recommendations: [
        'Implement table time limits during peak hours',
        'Optimize menu for faster preparation',
        'Improve service speed training for staff',
        'Consider table reservation system'
      ],
      dataSource: {
        metric: 'Table Utilization Rate',
        value: `${utilizationRate.toFixed(1)}%`,
        period: 'current'
      },
      confidence: 75,
      priority: 'medium',
      implementation: {
        difficulty: 'medium',
        timeframe: '2-4 weeks',
        estimatedImpact: '20-30% increase in daily customers'
      }
    });
  }

  // Store insights in database
  for (const insight of insights) {
    await storage.createAiInsight({
      restaurantId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      recommendations: insight.recommendations,
      dataSource: insight.dataSource,
      confidence: insight.confidence.toString(),
      priority: insight.priority,
      isRead: false,
      implementationStatus: 'pending'
    });
  }

  return insights;
}

// Generate starter insights for new restaurants
function generateStarterInsights(restaurantId: number): AIInsight[] {
  return [
    {
      type: 'operational',
      title: 'Digital Menu Setup Complete',
      description: 'Your QR code ordering system is ready! Focus on driving customer awareness and usage.',
      recommendations: [
        'Place QR codes prominently on all tables',
        'Train staff to help customers with QR scanning',
        'Create table tent cards explaining the digital ordering process',
        'Monitor first customer feedback closely'
      ],
      dataSource: {
        metric: 'System Status',
        value: 'Active',
        period: 'current'
      },
      confidence: 95,
      priority: 'high',
      implementation: {
        difficulty: 'easy',
        timeframe: '1 week',
        estimatedImpact: 'Improved customer experience and order efficiency'
      }
    },
    {
      type: 'marketing',
      title: 'Customer Acquisition Strategy',
      description: 'Start building your customer base with proven marketing tactics.',
      recommendations: [
        'Create social media accounts for your restaurant',
        'Encourage customers to leave reviews',
        'Implement a grand opening promotion',
        'Network with local businesses and events'
      ],
      dataSource: {
        metric: 'Customer Base',
        value: 'New Restaurant',
        period: 'startup phase'
      },
      confidence: 90,
      priority: 'high',
      implementation: {
        difficulty: 'medium',
        timeframe: '2-3 weeks',
        estimatedImpact: 'Build initial customer base'
      }
    },
    {
      type: 'menu',
      title: 'Menu Performance Tracking',
      description: 'Start tracking which items perform best to optimize your menu.',
      recommendations: [
        'Monitor which items are ordered most frequently',
        'Track customer feedback on different dishes',
        'Experiment with daily specials',
        'Adjust pricing based on popularity and costs'
      ],
      dataSource: {
        metric: 'Menu Analytics',
        value: 'Not enough data yet',
        period: 'startup phase'
      },
      confidence: 85,
      priority: 'medium',
      implementation: {
        difficulty: 'easy',
        timeframe: '1-2 weeks',
        estimatedImpact: 'Data-driven menu optimization'
      }
    }
  ];
}

// Enhanced restaurant chat functionality
export async function handleRestaurantChat(chatRequest: {
  message: string;
  context: {
    restaurantId: number;
    timeframe?: string;
    sessionId?: number;
  };
}): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return "I'd be happy to help you analyze your restaurant's performance! However, the AI service is currently not configured. I can provide detailed insights on revenue trends, menu optimization, customer satisfaction, operational efficiency, and profitability once the service is set up. What specific aspect of your business would you like to explore?";
    }

    const { message, context } = chatRequest;
    
    // Get restaurant data for context
    const [restaurant, insights] = await Promise.all([
      storage.getRestaurant(context.restaurantId),
      storage.getAiInsightsByRestaurantId(context.restaurantId)
    ]);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `
      You are an AI assistant for ${restaurant?.name || 'this restaurant'}, helping with business analysis and insights.
      
      Restaurant Context:
      - Restaurant: ${restaurant?.name || 'Unknown'}
      - Time period: ${context.timeframe || 'last 30 days'}
      
      Recent AI Insights:
      ${insights.slice(0, 3).map(insight => `- ${insight.title}: ${insight.description}`).join('\n')}
      
      Customer Question: "${message}"
      
      Guidelines:
      1. Be helpful and specific to restaurant operations
      2. Reference the restaurant's data when possible
      3. Provide actionable advice
      4. Keep responses concise but informative
      5. References recent AI insights if relevant to the question
      
      Respond as a knowledgeable restaurant business advisor.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Error in restaurant chat:', error);
    return "I'd be happy to help you analyze your restaurant's performance! I can provide detailed insights on revenue trends, menu optimization, customer satisfaction, operational efficiency, and profitability. What specific aspect of your business would you like to explore? I have access to your restaurant's data and can provide personalized recommendations.";
  }
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
export async function markInsightAsRead(insightId: number): Promise<void> {
  try {
    await storage.updateAiInsight(insightId, { isRead: true });
  } catch (error) {
    console.error('Error marking insight as read:', error);
  }
}

// Update insight implementation status
export async function updateInsightStatus(insightId: number, status: string): Promise<void> {
  try {
    await storage.updateAiInsight(insightId, { implementationStatus: status });
  } catch (error) {
    console.error('Error updating insight status:', error);
  }
}

// Analytics insights generation
export async function generateAnalyticsInsights({ 
  restaurantId, 
  startDate, 
  endDate 
}: { 
  restaurantId: number; 
  startDate: Date; 
  endDate: Date; 
}): Promise<AIInsight[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return [
        {
          type: 'performance',
          title: 'Analytics Period Summary',
          description: `Performance analysis for ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          recommendations: [
            "Set up AI service for detailed analytics",
            "Implement AI-powered analytics for deeper insights",
            "Track key performance indicators regularly"
          ],
          dataSource: {
            metric: 'Time Period',
            value: `${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
            period: 'custom range'
          },
          confidence: 50,
          priority: 'medium',
          implementation: {
            difficulty: 'easy',
            timeframe: '1 week',
            estimatedImpact: 'Better business insights'
          }
        }
      ];
    }

    // Get analytics data for the specified period
    const [orderCount, revenue, avgOrderValue, popularItems] = await Promise.all([
      storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate),
      storage.getRestaurantRevenue(restaurantId, startDate, endDate),
      storage.getAverageOrderValue(restaurantId, startDate, endDate),
      storage.getPopularMenuItems(restaurantId, 5, { startDate, endDate })
    ]);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `
      Analyze this restaurant's performance for the specified period and provide insights:
      
      Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
      - Total Orders: ${orderCount}
      - Revenue: $${revenue.toFixed(2)}
      - Average Order Value: $${avgOrderValue.toFixed(2)}
      - Top Items: ${popularItems.map(item => item.name).join(', ')}
      
      Provide 2-3 insights in JSON format with this structure:
      {
        "insights": [
          {
            "type": "performance|revenue|operational",
            "title": "Brief insight title",
            "description": "Analysis for this specific period",
            "recommendations": ["Action 1", "Action 2"],
            "dataSource": {
              "metric": "metric name",
              "value": "value",
              "period": "custom period"
            },
            "confidence": 80,
            "priority": "medium",
            "implementation": {
              "difficulty": "easy",
              "timeframe": "1-2 weeks",
              "estimatedImpact": "Expected outcome"
            }
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const insights = JSON.parse(jsonMatch[0]);
      return insights.insights || [];
    } catch (parseError) {
      console.error('Failed to parse analytics insights response');
      throw new Error('Failed to parse analytics insights response');
    }

  } catch (error) {
    console.error('Error generating analytics insights:', error);
    throw new Error('Failed to generate analytics insights');
  }
}
