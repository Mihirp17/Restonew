import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, User, Send, Zap, TrendingUp, BarChart3, UtensilsCrossed, Users, DollarSign, Clock, Target, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/language-context";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
}

interface AIChatboxProps {
  restaurantId: number;
}

const QUICK_ACTIONS = [
  {
    icon: TrendingUp,
    label: "Revenue Analysis",
    query: "How is my restaurant's revenue performing this month? What trends do you see and what can I do to improve it?",
    color: "text-green-600",
    bgColor: "bg-green-100"
  },
  {
    icon: UtensilsCrossed,
    label: "Menu Optimization",
    query: "Which menu items are performing best and which ones should I consider promoting, removing, or adjusting?",
    color: "text-orange-600",
    bgColor: "bg-orange-100"
  },
  {
    icon: Users,
    label: "Customer Insights",
    query: "What insights can you provide about my customers, their satisfaction levels, and how can I improve customer experience?",
    color: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  {
    icon: BarChart3,
    label: "Operations",
    query: "How can I improve my restaurant's operational efficiency, reduce wait times, and optimize staff scheduling?",
    color: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  {
    icon: DollarSign,
    label: "Profitability",
    query: "What are my current profit margins and what strategies can I implement to increase profitability?",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100"
  },
  {
    icon: Clock,
    label: "Peak Hours",
    query: "What are my busiest hours and how can I optimize operations during peak times to maximize revenue?",
    color: "text-red-600",
    bgColor: "bg-red-100"
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
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useLang();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Send message with enhanced context
  const sendMessage = useCallback(async (content: string) => {
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
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: content.trim() }];
    setConversationHistory(updatedHistory);

    try {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/ai-chat`, {
        message: content.trim(),
        context: {
          restaurantId,
          previousMessages: updatedHistory.slice(-5) // Send last 5 messages for context
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

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
        setConversationHistory(prev => [...prev, { role: 'assistant' as const, content: data.reply }]);
        setIsTyping(false);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      setIsLoading(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment. If the problem persists, please check your internet connection.",
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
    }
  }, [restaurantId, isLoading, conversationHistory, toast]);

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
    setMessages([
      {
        id: Date.now().toString(),
        content: "Hi! I'm your AI restaurant assistant. I can help you analyze your performance, optimize your menu, understand your customers, and improve your operations. What would you like to know about your restaurant?",
        isUser: false,
        timestamp: new Date()
      }
    ]);
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
    <Card className="h-[700px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <span>AI Assistant</span>
            <div className="flex items-center space-x-1 ml-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-gray-500">Powered by AI</span>
            </div>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearConversation}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear Chat
          </Button>
        </div>
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
                  <div className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'} max-w-full overflow-hidden`}>
                    <div className={`rounded-lg p-3 overflow-hidden ${
                      message.isUser 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      {formatTime(message.timestamp)}
                    </span>
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
        {messages.length === 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-3 font-medium">Quick Actions:</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleQuickAction(action.query)}
                  disabled={isLoading}
                  className={`flex items-center space-x-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${action.bgColor} ${action.color} text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <action.icon className="h-3 w-3" />
                  <span>{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your restaurant..."
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
          <p className="text-xs text-gray-500 mt-2 text-center">
            I can help with revenue analysis, menu optimization, customer insights, and operational efficiency.
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 