import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, User, Send, Zap, TrendingUp, BarChart3, UtensilsCrossed, Users, Settings, RefreshCw, MessageSquare, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIChatboxProps {
  restaurantId: number;
}

const QUICK_ACTIONS = [
  {
    icon: TrendingUp,
    label: "Revenue Analysis",
    query: "How is my restaurant's revenue performing this month? What trends do you see?",
    category: "revenue"
  },
  {
    icon: UtensilsCrossed,
    label: "Menu Optimization",
    query: "Which menu items are performing best and which ones should I consider promoting or removing?",
    category: "menu"
  },
  {
    icon: Users,
    label: "Customer Insights",
    query: "What insights can you provide about my customers and their satisfaction levels?",
    category: "customers"
  },
  {
    icon: BarChart3,
    label: "Operations",
    query: "How can I improve my restaurant's operational efficiency and reduce wait times?",
    category: "operations"
  },
  {
    icon: Brain,
    label: "Strategic Planning",
    query: "What strategic opportunities should I focus on for business growth?",
    category: "strategy"
  },
  {
    icon: MessageSquare,
    label: "Performance Review",
    query: "Give me a comprehensive overview of my restaurant's current performance and key metrics.",
    category: "analytics"
  }
];

export function AIChatbox({ restaurantId }: AIChatboxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm your AI restaurant assistant. I can help you analyze your performance, optimize your menu, understand your customers, and improve your operations. What would you like to know about your restaurant?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [userPreferences, setUserPreferences] = useState({
    detailLevel: 'detailed' as 'brief' | 'detailed' | 'technical',
    focusAreas: ['revenue', 'operations', 'customer_satisfaction'] as string[]
  });
  const [showSettings, setShowSettings] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: string}>>([]);
  
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

  // Send message with enhanced context
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

    // Update conversation history
    const updatedHistory = [...conversationHistory, {
      role: 'user' as const,
      content: content.trim(),
      timestamp: new Date().toISOString()
    }];
    setConversationHistory(updatedHistory);

    try {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/ai-chat`, {
        message: content.trim(),
        context: {
          restaurantId,
          sessionId,
          conversationHistory: updatedHistory.slice(-10), // Last 10 messages for context
          userPreferences,
          timeframe: '30d'
        }
      });

      const data = await response.json();

      // Simulate typing delay for better UX
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.reply,
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
        setIsLoading(false);

        // Update conversation history with AI response
        setConversationHistory(prev => [...prev, {
          role: 'assistant' as const,
          content: data.reply,
          timestamp: new Date().toISOString()
        }]);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      setIsLoading(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get AI response",
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

  // Clear conversation
  const clearConversation = () => {
    setMessages([{
      id: '1',
      content: "Hi! I'm your AI restaurant assistant. I can help you analyze your performance, optimize your menu, understand your customers, and improve your operations. What would you like to know about your restaurant?",
      isUser: false,
      timestamp: new Date()
    }]);
    setConversationHistory([]);
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
    <Card className="h-[600px] flex flex-col bg-gradient-to-br from-white to-purple-50/30 border-purple-200">
      <CardHeader className="pb-3 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-sm">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-900">AI Assistant</span>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  {userPreferences.detailLevel}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {conversationHistory.length} messages
                </Badge>
              </div>
            </div>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearConversation}
                    className="h-8 w-8 p-0"
                    disabled={messages.length <= 1}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear Conversation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 bg-white rounded-lg border border-purple-200"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Detail Level
                  </label>
                  <Select
                    value={userPreferences.detailLevel}
                    onValueChange={(value: 'brief' | 'detailed' | 'technical') =>
                      setUserPreferences(prev => ({ ...prev, detailLevel: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Focus Areas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['revenue', 'menu', 'operations', 'customers', 'analytics'].map((area) => (
                      <Badge
                        key={area}
                        variant={userPreferences.focusAreas.includes(area) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-purple-100"
                        onClick={() => {
                          setUserPreferences(prev => ({
                            ...prev,
                            focusAreas: prev.focusAreas.includes(area)
                              ? prev.focusAreas.filter(a => a !== area)
                              : [...prev.focusAreas, area]
                          }));
                        }}
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} w-full`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full shadow-sm ${
                    message.isUser 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                      : 'bg-gradient-to-r from-purple-500 to-purple-600'
                  }`}>
                    {message.isUser ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'} max-w-full overflow-hidden`}>
                    <div className={`rounded-lg p-3 shadow-sm overflow-hidden ${
                      message.isUser
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-white border border-purple-200 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{formatTime(message.timestamp)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            
            <AnimatePresence>
              {isTyping && <TypingIndicator />}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-4">
            <p className="text-sm text-gray-600 mb-3 font-medium">Quick questions:</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.query)}
                  disabled={isLoading}
                  className="h-auto p-3 flex flex-col items-start text-left hover:bg-purple-50 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <action.icon className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-xs">{action.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                    {action.category}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-purple-100 bg-white">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              data-chatbox-input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your restaurant..."
              disabled={isLoading}
              className="flex-1 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>AI powered by Gemini</span>
            <span>Session: {sessionId.slice(-8)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 