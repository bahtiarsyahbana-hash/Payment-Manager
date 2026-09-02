import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Button, Input, Label } from '../components/ui';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin(); // Since this is a dummy login, we just proceed
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-to-b from-[#d9eafd] via-[#eef5fd] to-white">
      {/* Subtle Background Concentric Circles matching inspiration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div className="absolute w-[600px] h-[600px] rounded-full border border-white/60"></div>
        <div className="absolute w-[900px] h-[900px] rounded-full border border-white/60"></div>
        <div className="absolute w-[1200px] h-[1200px] rounded-full border border-white/60"></div>
      </div>

      {/* Cloud-like soft glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/40 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/40 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,18,51,0.08)] overflow-hidden relative z-10 p-8 sm:p-10 border border-white/60">
        <div className="flex flex-col items-center">
          {/* Header Logo & Title */}
          <div className="w-16 h-16 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-50 flex items-center justify-center mb-4 p-1">
             <img 
                src="https://i.ibb.co.com/RGLHt7bM/Alt-02-removebg-preview.png" 
                alt="BCI Logo" 
                className="w-full h-full object-contain"
              />
          </div>
          <h1 className="text-lg font-bold text-[#001233] mb-6">IRIS - Payment Manager</h1>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Welcome Back</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">
            Sign in to manage your payment
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1 relative group">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#001233] transition-colors">
                  <Mail className="h-[18px] w-[18px]" />
                </div>
                <Input 
                  id="email" 
                  type="text" 
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 w-full rounded-2xl border-none bg-[#F4F4F5] focus:bg-white focus:ring-2 focus:ring-[#001233]/10 shadow-none text-gray-700 font-medium placeholder:text-gray-400 placeholder:font-normal transition-all"
                />
              </div>
            </div>

            <div className="space-y-1 relative group">
              <Label htmlFor="password" className="sr-only">Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#001233] transition-colors">
                  <Lock className="h-[18px] w-[18px]" />
                </div>
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 h-12 w-full rounded-2xl border-none bg-[#F4F4F5] focus:bg-white focus:ring-2 focus:ring-[#001233]/10 shadow-none text-gray-700 font-medium placeholder:text-gray-400 placeholder:font-normal transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 pb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-[#001233] focus:ring-[#001233] w-3.5 h-3.5 transition-colors"
                  defaultChecked
                />
                <span className="text-gray-500 font-medium select-none">Remember me</span>
              </label>
              <a href="#" className="font-medium text-gray-600 hover:text-[#001233] transition-colors">
                Forgot password?
              </a>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-[#252830] hover:bg-[#001233] text-white rounded-2xl font-medium shadow-[0_4px_12px_rgba(0,18,51,0.2)] hover:shadow-[0_6px_16px_rgba(0,18,51,0.3)] transition-all text-sm"
            >
              Get Started
            </Button>
          </form>

          <div className="mt-8 w-full">
            <div className="relative flex items-center mb-6">
              <div className="flex-grow border-t border-dashed border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-xs font-medium text-gray-400 bg-transparent tracking-wide">Or sign in with</span>
              <div className="flex-grow border-t border-dashed border-gray-200"></div>
            </div>

            <div className="flex justify-center space-x-4">
              <button className="w-[72px] h-11 flex items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  <path d="M1 1h22v22H1z" fill="none"/>
                </svg>
              </button>
              <button className="w-[72px] h-11 flex items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
                </svg>
              </button>
              <button className="w-[72px] h-11 flex items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] transition-all text-black">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.365 21.442c-1.396.953-2.663.985-4.084.14-1.378-.823-2.67-1.1-4.053-.105-2.094 1.486-3.877-.52-5.71-3.184-2.883-4.143-3.693-8.835-1.4-11.45 1.15-1.34 2.766-2.128 4.417-2.164 1.62-.036 2.628.75 4.31.75 1.683 0 2.827-.858 4.67-.785 1.448.036 2.9.68 3.864 1.764-3.327 1.942-2.793 6.47 1.01 7.96-1.025 2.91-2.176 5.864-3.024 7.074zm-2.115-18.06c.645-1.026 1.055-2.28 1.03-3.382-1.096.108-2.327.683-3.09 1.447-.645.642-1.124 1.713-.886 2.864 1.192.177 2.302-.34 2.946-.93z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
          <p className="text-sm text-gray-500">
            Don't have an account? 
            <a href="#" className="font-medium text-[#001233] hover:underline ml-1">Register here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
