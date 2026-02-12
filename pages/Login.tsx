import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f6f7f8]">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[650px]">
        {/* Left Side: Visual */}
        <div className="relative hidden md:flex md:w-1/2 bg-slate-900 flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-217358c7db81?auto=format&fit=crop&q=80&w=2000" 
              alt="Medical Education" 
              className="w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 to-blue-600/40 mix-blend-multiply" />
          </div>
          
          <div className="relative z-10 p-12 h-full flex flex-col justify-between text-white">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <span className="text-2xl font-bold">EduNurse<span className="font-light opacity-80">Pro</span></span>
            </div>

            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight">Empowering the next generation of healthcare heroes.</h2>
              <p className="text-lg text-white/90 font-light">Access curriculum-aligned teaching documents, generate lesson plans, and track student progress seamlessly.</p>
              
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 mt-8">
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                       <img key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src={`https://picsum.photos/id/${i + 50}/100/100`} alt=""/>
                   ))}
                </div>
                <div className="text-sm">
                  <p className="font-medium">Trusted by 12,000+ Tutors</p>
                  <div className="flex text-yellow-400">★★★★★</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white">
            <div className="w-full max-w-md mx-auto space-y-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
                    <p className="text-slate-500">Please enter your details to access your curriculum tools.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Email Address</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Mail size={20} />
                            </div>
                            <input 
                                type="email" 
                                placeholder="tutor@hospital.edu" 
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                defaultValue="tutor@hospital.edu"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                         <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-slate-700">Password</label>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock size={20} />
                            </div>
                            <input 
                                type="password" 
                                placeholder="••••••••" 
                                className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                defaultValue="password"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400">
                                <EyeOff size={20} />
                            </div>
                        </div>
                         <div className="flex justify-end">
                            <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">Forgot password?</a>
                        </div>
                    </div>

                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                        Sign In
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" className="flex items-center justify-center px-4 py-2 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            Google
                        </button>
                        <button type="button" className="flex items-center justify-center px-4 py-2 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            Microsoft
                        </button>
                    </div>
                </form>
                
                <p className="mt-4 text-center text-sm text-slate-600">
                    Don't have an account? <a href="#" className="font-semibold text-blue-600 hover:text-blue-500">Create an account</a>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
