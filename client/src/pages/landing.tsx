import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { 
  QrCode, 
  BarChart3, 
  Users, 
  Smartphone, 
  Code2,
  Menu,
  X,
  Languages,
  Clock,
  LineChart,
  ChefHat,
  Brain
} from "lucide-react";

const features = [
  {
    icon: <QrCode className="h-6 w-6" />,
    title: "QR Code Ordering System",
    description: "Customers scan QR codes to place orders directly from their phones, with table-specific QR codes for easy tracking"
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: "Manager Dashboard",
    description: "Real-time order management on phone/desktop with seamless POS integration for efficient operations"
  },
  {
    icon: <ChefHat className="h-6 w-6" />,
    title: "Menu Optimization",
    description: "Data-driven menu management highlighting best sellers and optimizing item placement"
  },
  {
    icon: <Languages className="h-6 w-6" />,
    title: "Multilingual Support",
    description: "Full support for Spanish, English, French, and German with automatic language detection"
  },
  {
    icon: <LineChart className="h-6 w-6" />,
    title: "Advanced Analytics",
    description: "Daily revenue breakdown, item-wise sales analysis, and peak hour identification"
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "Menu Intelligence",
    description: "Dynamic menu optimization based on time periods, customer preferences, and sales data"
  }
];

const pricingPlans = [
  {
    name: "Basic",
    price: "$29",
    features: [
      "QR Code Ordering",
      "Basic Analytics",
      "Up to 5 staff accounts",
      "Email Support"
    ]
  },
  {
    name: "Premium",
    price: "$99",
    features: [
      "All Basic features",
      "Advanced Analytics",
      "Up to 20 staff accounts",
      "Priority Support",
      "Custom Branding"
    ]
  },
  {
    name: "Enterprise",
    price: "$249",
    features: [
      "All Premium features",
      "Unlimited staff accounts",
      "24/7 Support",
      "API Access",
      "Custom Development"
    ]
  }
];

const testimonials = [
  {
    name: "John Smith",
    role: "Restaurant Owner",
    content: "Restomate has transformed how we handle orders. The QR code system is a game-changer!"
  },
  {
    name: "Sarah Johnson",
    role: "Manager",
    content: "The analytics dashboard gives us valuable insights into our business performance."
  },
  {
    name: "Mike Brown",
    role: "Chef",
    content: "The mobile-first design makes it easy for our staff to manage orders efficiently."
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-[#ffffff]/80 backdrop-blur-sm border-b border-[#373643]/10 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-[#373643]">Restomate</Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-[#373643] hover:text-[#ba1d1d] transition-colors">Features</Link>
            <Link href="#pricing" className="text-[#373643] hover:text-[#ba1d1d] transition-colors">Pricing</Link>
            <Link href="#testimonials" className="text-[#373643] hover:text-[#ba1d1d] transition-colors">Testimonials</Link>
            <ThemeToggle />
            <Button asChild className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90">
              <Link href="/login">Log in</Link>
            </Button>
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-[#373643]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-[#ffffff]">
              <div className="flex flex-col space-y-4 mt-8">
                <Link href="#features" className="text-lg text-[#373643] hover:text-[#ba1d1d]">Features</Link>
                <Link href="#pricing" className="text-lg text-[#373643] hover:text-[#ba1d1d]">Pricing</Link>
                <Link href="#testimonials" className="text-lg text-[#373643] hover:text-[#ba1d1d]">Testimonials</Link>
                <ThemeToggle />
                <Button asChild className="w-full bg-[#ba1d1d] hover:bg-[#ba1d1d]/90">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-[#373643]"
          >
            Transform Your Restaurant with
            <span className="text-[#ba1d1d]"> Restomate</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-[#373643]/80 mb-8 max-w-2xl mx-auto"
          >
            Streamline your operations, enhance customer experience, and boost your revenue with our all-in-one restaurant management platform.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" asChild className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90">
              <Link href="/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-[#373643] text-[#373643] hover:bg-[#373643] hover:text-[#ffffff]">
              <Link href="#features">Learn More</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-[#373643]/5">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 text-[#373643]">Key Features</h2>
          <p className="text-[#373643]/80 text-center mb-12 max-w-2xl mx-auto">
            Transform your restaurant operations with our comprehensive suite of features designed for modern dining experiences
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-[#ba1d1d]/10 hover:border-[#ba1d1d]/20 bg-[#ffffff]">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-[#ba1d1d]/10 flex items-center justify-center text-[#ba1d1d] mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-[#ba1d1d]">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[#373643]/80">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-[#ffffff]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-[#373643]">Simple, Transparent Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow bg-[#ffffff] border-[#373643]/10">
                  <CardHeader>
                    <CardTitle className="text-[#373643]">{plan.name}</CardTitle>
                    <div className="text-3xl font-bold mt-4 text-[#ba1d1d]">{plan.price}<span className="text-[#373643]/60 text-lg">/month</span></div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center text-[#373643]">
                          <svg className="h-5 w-5 text-[#ba1d1d] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full mt-8 bg-[#ba1d1d] hover:bg-[#ba1d1d]/90" asChild>
                      <Link href="/register">Get Started</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-[#373643]/5">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-[#373643]">What Our Customers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full bg-[#ffffff]">
                  <CardContent className="pt-6">
                    <p className="text-[#373643]/80 mb-4">"{testimonial.content}"</p>
                    <div>
                      <p className="font-semibold text-[#373643]">{testimonial.name}</p>
                      <p className="text-sm text-[#373643]/60">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#373643] text-[#ffffff]">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Restomate</h3>
              <p className="text-[#ffffff]/80">Transform your restaurant management with our innovative platform.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="#features" className="text-[#ffffff]/80 hover:text-[#ffffff]">Features</Link></li>
                <li><Link href="#pricing" className="text-[#ffffff]/80 hover:text-[#ffffff]">Pricing</Link></li>
                <li><Link href="#testimonials" className="text-[#ffffff]/80 hover:text-[#ffffff]">Testimonials</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-[#ffffff]/80 hover:text-[#ffffff]">About</Link></li>
                <li><Link href="/contact" className="text-[#ffffff]/80 hover:text-[#ffffff]">Contact</Link></li>
                <li><Link href="/blog" className="text-[#ffffff]/80 hover:text-[#ffffff]">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-[#ffffff]/80 hover:text-[#ffffff]">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-[#ffffff]/80 hover:text-[#ffffff]">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#ffffff]/10 mt-12 pt-8 text-center text-[#ffffff]/60">
            <p>&copy; {new Date().getFullYear()} Restomate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 