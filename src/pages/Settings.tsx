/**
 * Settings Page
 * Comprehensive user profile and settings management
 */

import React, { useState, useEffect } from "react";
import { 
  User, 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Activity,
  LogOut,
  ChevronRight
} from "lucide-react";
import { ProfileSettings } from "./ProfileSettings";
import { useAuth } from "../src/context/AuthContext";
import { useNavigate } from "react-router-dom";

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "profile" | "preferences" | "notifications" | "security" | "activity"
  >("profile");
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/signin");
  };

  const navItems = [
    { id: "profile", label: "Profile", icon: User, description: "Manage your personal information" },
    { id: "preferences", label: "Preferences", icon: SettingsIcon, description: "Customize your experience" },
    { id: "notifications", label: "Notifications", icon: Bell, description: "Control your email alerts" },
    { id: "security", label: "Security", icon: Shield, description: "Password and account security" },
    { id: "activity", label: "Activity", icon: Activity, description: "View your usage history" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account settings and preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ease-in-out ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-blue-500" : "text-gray-400"}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 text-blue-500" />}
                </button>
              );
            })}
            
            <div className="pt-4 mt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-150"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px]">
          {activeTab === "profile" && <ProfileSettings />}
          
          {activeTab === "preferences" && (
            <div className="p-8 text-center text-gray-500">
              <SettingsIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Preferences</h3>
              <p>Preferences settings form goes here.</p>
            </div>
          )}
          
          {activeTab === "notifications" && (
            <div className="p-8 text-center text-gray-500">
              <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <p>Notification settings form goes here.</p>
            </div>
          )}
          
          {activeTab === "security" && (
            <div className="p-8 text-center text-gray-500">
              <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Security</h3>
              <p>Security settings form goes here.</p>
            </div>
          )}
          
          {activeTab === "activity" && (
            <div className="p-8 text-center text-gray-500">
              <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Activity</h3>
              <p>Activity history goes here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;