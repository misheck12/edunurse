import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Calendar,
  Edit3,
  Camera,
  Award,
  Target,
  Clock,
  TrendingUp,
  BookOpen,
  CheckCircle,
  Star,
  Flame,
  Trophy,
  Zap,
  Heart,
  Brain,
  Stethoscope,
  Pill,
  Activity,
  Settings,
  ChevronRight,
  FileText,
  Play
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../src/context/AuthContext";
import SEO from "../src/components/SEO";

interface ActivityItem {
  id: string;
  type: "quiz" | "flashcard" | "clinical_case" | "lesson" | "achievement";
  title: string;
  description: string;
  timestamp: Date;
  score?: number;
  icon: React.ElementType;
  color: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  earnedAt?: Date;
  progress?: number;
  total?: number;
}

interface LearningStats {
  totalQuizzes: number;
  quizAccuracy: number;
  flashcardsStudied: number;
  clinicalCases: number;
  studyStreak: number;
  totalStudyTime: number;
  lessonsCreated: number;
}

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "achievements">("overview");
  const [stats, setStats] = useState<LearningStats>({
    totalQuizzes: 0,
    quizAccuracy: 0,
    flashcardsStudied: 0,
    clinicalCases: 0,
    studyStreak: 0,
    totalStudyTime: 0,
    lessonsCreated: 0
  });

  // Load stats from localStorage
  useEffect(() => {
    const loadStats = () => {
      const quizHistory = JSON.parse(localStorage.getItem("drugCalcHistory") || "[]");
      const flashcardStats = JSON.parse(localStorage.getItem("flashcardStats") || "{}");
      const clinicalHistory = JSON.parse(localStorage.getItem("clinicalCaseHistory") || "[]");
      const studyStreak = parseInt(localStorage.getItem("studyStreak") || "0");
      const totalStudyTime = parseInt(localStorage.getItem("totalStudyTime") || "0");
      const lessonsCreated = parseInt(localStorage.getItem("lessonsCreated") || "0");

      // Calculate quiz accuracy
      let totalCorrect = 0;
      let totalQuestions = 0;
      quizHistory.forEach((session: { correct: number; total: number }) => {
        totalCorrect += session.correct || 0;
        totalQuestions += session.total || 0;
      });

      setStats({
        totalQuizzes: quizHistory.length,
        quizAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        flashcardsStudied: flashcardStats.totalCards || 0,
        clinicalCases: clinicalHistory.length,
        studyStreak: studyStreak,
        totalStudyTime: totalStudyTime,
        lessonsCreated: lessonsCreated
      });
    };

    loadStats();
  }, []);

  // Mock recent activity data
  const recentActivity: ActivityItem[] = [
    {
      id: "1",
      type: "quiz",
      title: "Drug Calculation Quiz",
      description: "Completed with 85% accuracy",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      score: 85,
      icon: Pill,
      color: "bg-blue-500"
    },
    {
      id: "2",
      type: "flashcard",
      title: "Anatomy Flashcards",
      description: "Reviewed 24 cards",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      icon: Brain,
      color: "bg-purple-500"
    },
    {
      id: "3",
      type: "clinical_case",
      title: "Cardiac Assessment Case",
      description: "Scored 90% on diagnosis",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      score: 90,
      icon: Stethoscope,
      color: "bg-green-500"
    },
    {
      id: "4",
      type: "lesson",
      title: "Pediatric Nursing Lesson",
      description: "Created new lesson plan",
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      icon: FileText,
      color: "bg-amber-500"
    }
  ];

  // Achievements
  const achievements: Achievement[] = [
    {
      id: "1",
      name: "First Steps",
      description: "Complete your first quiz",
      icon: Star,
      color: "bg-yellow-500",
      earnedAt: stats.totalQuizzes > 0 ? new Date() : undefined
    },
    {
      id: "2",
      name: "Quiz Master",
      description: "Complete 10 quizzes",
      icon: Trophy,
      color: "bg-amber-500",
      progress: stats.totalQuizzes,
      total: 10,
      earnedAt: stats.totalQuizzes >= 10 ? new Date() : undefined
    },
    {
      id: "3",
      name: "Streak Starter",
      description: "Maintain a 3-day study streak",
      icon: Flame,
      color: "bg-orange-500",
      progress: stats.studyStreak,
      total: 3,
      earnedAt: stats.studyStreak >= 3 ? new Date() : undefined
    },
    {
      id: "4",
      name: "Clinical Expert",
      description: "Complete 5 clinical cases",
      icon: Stethoscope,
      color: "bg-green-500",
      progress: stats.clinicalCases,
      total: 5,
      earnedAt: stats.clinicalCases >= 5 ? new Date() : undefined
    },
    {
      id: "5",
      name: "Card Collector",
      description: "Study 100 flashcards",
      icon: Brain,
      color: "bg-purple-500",
      progress: stats.flashcardsStudied,
      total: 100,
      earnedAt: stats.flashcardsStudied >= 100 ? new Date() : undefined
    },
    {
      id: "6",
      name: "Perfect Score",
      description: "Get 100% on any quiz",
      icon: Zap,
      color: "bg-blue-500",
      earnedAt: stats.quizAccuracy === 100 ? new Date() : undefined
    },
    {
      id: "7",
      name: "Educator",
      description: "Create your first lesson plan",
      icon: BookOpen,
      color: "bg-indigo-500",
      earnedAt: stats.lessonsCreated > 0 ? new Date() : undefined
    },
    {
      id: "8",
      name: "Dedicated Learner",
      description: "Study for 10 hours total",
      icon: Clock,
      color: "bg-teal-500",
      progress: Math.floor(stats.totalStudyTime / 60),
      total: 600,
      earnedAt: stats.totalStudyTime >= 600 ? new Date() : undefined
    }
  ];

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const earnedCount = achievements.filter(a => a.earnedAt).length;

  return (
    <div>
      <SEO title="My Profile" description="View your learning progress and achievements" />
      
      {/* Profile Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-40 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
        </div>

        {/* Profile Info */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl font-bold text-blue-600">
                      {(user?.fullName || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <button className="absolute bottom-1 right-1 p-2 bg-white rounded-full shadow-md border border-slate-200 hover:bg-gray-50 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left pb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {user?.fullName || "Student"}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="w-4 h-4" />
                    {user?.school || "Nursing Student"}
                  </span>
                  {user?.studentNumber && (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {user.studentNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <Flame className="w-3 h-3 mr-1" />
                    {stats.studyStreak} day streak
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <Trophy className="w-3 h-3 mr-1" />
                    {earnedCount} achievements
                  </span>
                </div>
              </div>

              {/* Edit Profile Button */}
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs text-green-600 font-medium">+{stats.quizAccuracy}%</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.totalQuizzes}</p>
            <p className="text-sm text-slate-500">Quizzes Completed</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.flashcardsStudied}</p>
            <p className="text-sm text-slate-500">Cards Studied</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-green-100 rounded-lg">
                <Stethoscope className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.clinicalCases}</p>
            <p className="text-sm text-slate-500">Clinical Cases</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{formatStudyTime(stats.totalStudyTime)}</p>
            <p className="text-sm text-slate-500">Study Time</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            {[
              { id: "overview", label: "Overview", icon: Activity },
              { id: "activity", label: "Activity", icon: Clock },
              { id: "achievements", label: "Achievements", icon: Award }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Link
                  to="/drug-calculator"
                  className="flex flex-col items-center p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <Pill className="w-8 h-8 text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Drug Quiz</span>
                </Link>
                <Link
                  to="/flashcards"
                  className="flex flex-col items-center p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <Brain className="w-8 h-8 text-purple-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Flashcards</span>
                </Link>
                <Link
                  to="/clinical-cases"
                  className="flex flex-col items-center p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <Stethoscope className="w-8 h-8 text-green-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Clinical Cases</span>
                </Link>
                <Link
                  to="/lesson-generator"
                  className="flex flex-col items-center p-4 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  <BookOpen className="w-8 h-8 text-amber-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Lesson Plan</span>
                </Link>
                <Link
                  to="/mock-exam"
                  className="flex flex-col items-center p-4 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <FileText className="w-8 h-8 text-red-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Mock Exam</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex flex-col items-center p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <Settings className="w-8 h-8 text-slate-600 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Settings</span>
                </Link>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Profile Completion</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Complete</span>
                    <span className="font-medium text-slate-900">
                      {Math.round(
                        ([
                          user?.fullName,
                          user?.email,
                          user?.phoneNumber,
                          user?.school,
                          user?.studentNumber,
                          user?.information
                        ].filter(Boolean).length / 6) * 100
                      )}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          ([
                            user?.fullName,
                            user?.email,
                            user?.phoneNumber,
                            user?.school,
                            user?.studentNumber,
                            user?.information
                          ].filter(Boolean).length / 6) * 100
                        }%`
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: "Full Name", done: !!user?.fullName },
                    { label: "Email", done: !!user?.email },
                    { label: "Phone Number", done: !!user?.phoneNumber },
                    { label: "School", done: !!user?.school },
                    { label: "Student Number", done: !!user?.studentNumber },
                    { label: "Bio", done: !!user?.information }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <CheckCircle
                        className={`w-4 h-4 ${
                          item.done ? "text-green-500" : "text-slate-300"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          item.done ? "text-slate-700" : "text-slate-400"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/settings"
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Complete Profile
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Recent Activity Preview */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                <button
                  onClick={() => setActiveTab("activity")}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {recentActivity.slice(0, 3).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${activity.color}`}>
                      <activity.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-slate-500">{activity.description}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Activity History</h3>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className={`p-3 rounded-xl ${activity.color}`}>
                    <activity.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                    <p className="text-sm text-slate-500">{activity.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                  {activity.score !== undefined && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{activity.score}%</p>
                      <p className="text-xs text-slate-500">Score</p>
                    </div>
                  )}
                </div>
              ))}

              {recentActivity.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No activity yet. Start learning!</p>
                  <Link
                    to="/drug-calculator"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    <Play className="w-4 h-4" />
                    Start a Quiz
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-6">
            {/* Achievement Stats */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {earnedCount} / {achievements.length}
                  </p>
                  <p className="text-amber-100">Achievements Earned</p>
                </div>
              </div>
            </div>

            {/* Achievement Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`relative bg-white rounded-xl border p-5 transition-all ${
                    achievement.earnedAt
                      ? "border-amber-200 shadow-sm"
                      : "border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl ${
                        achievement.earnedAt ? achievement.color : "bg-slate-200"
                      }`}
                    >
                      <achievement.icon
                        className={`w-6 h-6 ${
                          achievement.earnedAt ? "text-white" : "text-slate-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{achievement.name}</h4>
                      <p className="text-sm text-slate-500 mt-1">{achievement.description}</p>

                      {achievement.progress !== undefined && achievement.total && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Progress</span>
                            <span className="text-slate-700 font-medium">
                              {Math.min(achievement.progress, achievement.total)} / {achievement.total}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                achievement.earnedAt ? "bg-amber-500" : "bg-blue-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (achievement.progress / achievement.total) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {achievement.earnedAt && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
