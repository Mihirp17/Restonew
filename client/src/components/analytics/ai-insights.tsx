import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Brain, TrendingUp, Lightbulb, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIInsightsProps {
  restaurantId: number;
  startDate: Date;
  endDate: Date;
}

interface RestaurantInsights {
  performanceSummary: string;
  recommendations: string[];
  popularItemsAnalysis: string;
  customerSatisfaction: string;
  growthOpportunities: string[];
}

export function AIInsights({ restaurantId, startDate, endDate }: AIInsightsProps) {
  const [insights, setInsights] = useState<RestaurantInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest(
        "POST",
        `/api/restaurants/${restaurantId}/analytics/ai-insights`,
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate insights");
      }
      
      const data = await response.json();
      setInsights(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate AI insights";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!insights && !loading && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Insights
          </CardTitle>
          <CardDescription>
            Get intelligent analysis and recommendations for your restaurant
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Generate AI-powered insights based on your restaurant's performance data
          </p>
          <Button onClick={generateInsights} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={generateInsights} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing your restaurant data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{insights?.performanceSummary}</p>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {insights?.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary font-semibold">{index + 1}.</span>
                <span className="text-sm">{recommendation}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Popular Items Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Popular Items Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{insights?.popularItemsAnalysis}</p>
        </CardContent>
      </Card>

      {/* Customer Satisfaction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Satisfaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{insights?.customerSatisfaction}</p>
        </CardContent>
      </Card>

      {/* Growth Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Growth Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {insights?.growthOpportunities.map((opportunity, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">{opportunity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={generateInsights} variant="outline">
          Regenerate Insights
        </Button>
      </div>
    </div>
  );
}