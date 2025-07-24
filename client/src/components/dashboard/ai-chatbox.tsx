import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, User, Send, Zap, TrendingUp, BarChart3, UtensilsCrossed, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChartContainer } from "@/components/ui/chart";
import { useLang } from "@/contexts/language-context";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIChatboxProps {
  restaurantId: number;
}

const QUICK_ACTIONS = (t: (key: string) => string) => [
  {
    icon: TrendingUp,
    label: t('aiChat.quickActions.revenue'),
    query: t('aiChat.quickActions.revenueQuery')
  },
  {
    icon: UtensilsCrossed,
    label: t('aiChat.quickActions.menu'),
    query: t('aiChat.quickActions.menuQuery')
  },
  {
    icon: Users,
    label: t('aiChat.quickActions.customer'),
    query: t('aiChat.quickActions.customerQuery')
  },
  {
    icon: BarChart3,
    label: t('aiChat.quickActions.operations'),
    query: t('aiChat.quickActions.operationsQuery')
  }
];

// Helper to extract chart JSON from AI response
function extractChartJson(text: string) {
  const start = text.indexOf('CHART_JSON_START');
  const end = text.indexOf('CHART_JSON_END');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonText = text.substring(start + 16, end).trim();
    try {
      const chartObj = JSON.parse(jsonText);
      return chartObj.chart ? chartObj : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Helper to remove chart JSON block from text
function removeChartJson(text: string) {
  const start = text.indexOf('CHART_JSON_START');
  const end = text.indexOf('CHART_JSON_END');
  if (start !== -1 && end !== -1 && end > start) {
    return (text.substring(0, start) + text.substring(end + 15)).trim();
  }
  return text;
}

export function AIChatbox({ restaurantId }: AIChatboxProps) {
  const { lang, t } = useLang();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: t('aiChat.welcome'),
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/ai-chat?lang=${lang}`, {
        message: content.trim()
      });

      const data = await response.json();

      // Simulate typing delay
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.reply, // Use the correct property from backend
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      setIsLoading(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: t('aiChat.error'),
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: t('error'),
        description: t('aiChat.toast.error'),
        variant: "destructive"
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Handle quick action click
  const handleQuickAction = (query: string) => {
    sendMessage(query);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Typing indicator component
  const TypingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-center space-x-2 p-3"
    >
      <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
        <Bot className="h-4 w-4 text-purple-600" />
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </motion.div>
  );

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <span>{t('aiChat.title')}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 max-h-[380px] min-h-[200px]">
          <div className="space-y-4 pb-4">
            {messages.map((message) => {
              if (!message.isUser) {
                const chartObj = extractChartJson(message.content);
                const explanation = removeChartJson(message.content);
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex justify-start w-full`}
                  >
                    <div className="flex items-end gap-2 w-full max-w-full">
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 max-w-[80%]">
                        <div className="whitespace-pre-line text-sm text-gray-900 dark:text-gray-100">{explanation}</div>
                        {chartObj && chartObj.chart && (
                          <div className="mt-4">
                            <ChartContainer config={{}}>
                              {/* You may need to map chartObj.chart to the correct Recharts component here */}
                              {/* For now, just JSON.stringify for debug */}
                              <pre className="text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded">{JSON.stringify(chartObj.chart, null, 2)}</pre>
                            </ChartContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} w-full`}
                >
                  <div className={`flex items-end gap-2 w-full max-w-full ${message.isUser ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
                      message.isUser 
                        ? 'bg-blue-100' 
                        : 'bg-purple-100'
                    }`}>
                      {message.isUser ? (
                        <User className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Bot className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    {/* Bubble */}
                    <div className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'} max-w-[80%] min-w-0`}>
                      <div className={`rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words overflow-wrap-anywhere shadow ${
                        message.isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`} style={{ wordBreak: 'break-word', maxWidth: '100%' }}>
                        <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <AnimatePresence>
              {isTyping && <TypingIndicator />}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-4">
            <p className="text-sm text-gray-600 mb-3">{t('aiChat.quickQuestions')}</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS(t).map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.query)}
                  disabled={isLoading}
                  className="h-auto p-3 flex flex-col items-start text-left hover:bg-purple-50 hover:border-purple-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <action.icon className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-xs">{action.label}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              data-chatbox-input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('aiChat.placeholder')}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!inputValue.trim() || isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            {t('aiChat.promptExamples')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
