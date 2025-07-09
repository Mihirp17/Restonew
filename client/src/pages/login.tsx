import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChefHat } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoginPending } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const user = await login(email, password);
      
      // Redirect based on user role
      if (user.role === 'platform_admin') {
        navigate('/admin');
      } else if (user.role === 'restaurant') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-[#373643]/[0.02]">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#ba1d1d]/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#ba1d1d]/[0.03] rounded-full translate-x-1/2 translate-y-1/2"></div>
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      {/* Login Card */}
      <Card className="w-full max-w-md bg-[#ffffff]/80 backdrop-blur-sm border-[#373643]/10 shadow-xl relative z-10">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#ba1d1d]/10 flex items-center justify-center mb-2">
            <ChefHat className="h-6 w-6 text-[#ba1d1d]" />
          </div>
          <CardTitle className="text-3xl font-bold text-[#ba1d1d] tracking-tight">Welcome Back</CardTitle>
          <CardDescription className="text-[#373643]/80 text-base">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6 bg-[#ba1d1d]/10 border-[#ba1d1d]/20 text-[#ba1d1d]">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#373643] text-sm font-medium">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-[#373643]/20 focus:border-[#ba1d1d] focus:ring-[#ba1d1d]/20 bg-white/50 backdrop-blur-sm"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#373643] text-sm font-medium">Password</Label>
                <a href="#" className="text-xs text-[#ba1d1d] hover:text-[#ba1d1d]/80 hover:underline transition-colors">
                  Forgot password?
                </a>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-[#373643]/20 focus:border-[#ba1d1d] focus:ring-[#ba1d1d]/20 bg-white/50 backdrop-blur-sm"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-11 bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#ba1d1d]/20"
              disabled={isLoginPending}
            >
              {isLoginPending ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="justify-center text-sm pt-6 border-t border-[#373643]/10">
          <span className="text-[#373643]/60">
            Don't have an account?{" "}
            <a href="/register" className="text-[#ba1d1d] hover:text-[#ba1d1d]/80 hover:underline transition-colors font-medium">
              Register
            </a>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
