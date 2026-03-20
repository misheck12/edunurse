/**
 * Profile Settings Component
 * Detailed user profile management form
 */

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Award,
  Link as LinkIcon,
  Camera,
  Save,
  Loader2,
  Building2,
  GraduationCap,
  Globe,
  Github,
  Linkedin,
  Twitter,
  BookOpen
} from "lucide-react";
import { useAuth } from "../src/context/AuthContext";

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  school?: string;
  studentNumber?: string;
  information?: string; // Bio
  role: string;
  profile: {
    department?: string;
    position?: string;
    bio?: string;
    avatar?: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
    socialLinks?: {
      linkedin?: string;
      twitter?: string;
      website?: string;
      github?: string;
    };
    professionalInfo?: {
      yearsOfExperience?: number;
      specializations?: string[];
      qualifications?: string[];
      teachingAreas?: string[];
    };
  };
}

export const ProfileSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Section state for accordion/tabs within profile if needed, 
  // currently seeing all at once is better for overview.

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    school: "",
    studentNumber: "",
    bio: "",
    department: "",
    position: "",
    country: "",
    city: "",
    timezone: "",
    linkedin: "",
    twitter: "",
    website: "",
    github: "",
    yearsOfExperience: 0,
    specializations: [] as string[],
    qualifications: [] as string[],
    teachingAreas: [] as string[],
    avatar: ""
  });

  const [newSpecialization, setNewSpecialization] = useState("");
  const [newQualification, setNewQualification] = useState("");
  const [newTeachingArea, setNewTeachingArea] = useState("");

  const { token } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load profile");

      const data = await response.json();
      const profile = data.data;

      setFormData({
        fullName: profile.fullName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
        school: profile.school || "",
        studentNumber: profile.studentNumber || "",
        bio: profile.profile?.bio || profile.information || "",
        department: profile.profile?.department || "",
        position: profile.profile?.position || "",
        country: profile.profile?.location?.country || "",
        city: profile.profile?.location?.city || "",
        timezone: profile.profile?.location?.timezone || "",
        linkedin: profile.profile?.socialLinks?.linkedin || "",
        twitter: profile.profile?.socialLinks?.twitter || "",
        website: profile.profile?.socialLinks?.website || "",
        github: profile.profile?.socialLinks?.github || "",
        yearsOfExperience: profile.profile?.professionalInfo?.yearsOfExperience || 0,
        specializations: profile.profile?.professionalInfo?.specializations || [],
        qualifications: profile.profile?.professionalInfo?.qualifications || [],
        teachingAreas: profile.profile?.professionalInfo?.teachingAreas || [],
        avatar: profile.profile?.avatar || ""
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      setMessage({ type: "error", text: "Failed to load profile data." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddItem = (
    field: "specializations" | "qualifications" | "teachingAreas",
    value: string,
    setter: (val: string) => void
  ) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));
    setter("");
  };

  const handleRemoveItem = (
    field: "specializations" | "qualifications" | "teachingAreas",
    index: number
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Transform flat form data back to nested structure expected by backend
    const payload = {
      fullName: formData.fullName,
      email: formData.email, // Note: email might be read-only on backend depending on policy
      phoneNumber: formData.phoneNumber,
      school: formData.school,
      studentNumber: formData.studentNumber,
      information: formData.bio,
      department: formData.department,
      position: formData.position,
      bio: formData.bio,
      avatar: formData.avatar,
      location: {
        country: formData.country,
        city: formData.city,
        timezone: formData.timezone
      },
      socialLinks: {
        linkedin: formData.linkedin,
        twitter: formData.twitter,
        website: formData.website,
        github: formData.github
      },
      professionalInfo: {
        yearsOfExperience: parseInt(formData.yearsOfExperience.toString()) || 0,
        specializations: formData.specializations,
        qualifications: formData.qualifications,
        teachingAreas: formData.teachingAreas
      }
    };

    try {
      const response = await fetch("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      setMessage({ type: "success", text: "Profile updated successfully!" });

      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);

      // Reload to get processed data
      await loadProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: "Failed to update profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Profile Information</h2>
          <p className="text-sm text-slate-500">Update your personal and professional details.</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Avatar Section */}
        <div className="flex items-center space-x-6 p-6 bg-gray-50 rounded-xl border border-slate-200">
          <div className="relative">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Profile"
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-sm"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-sm">
                <User className="h-10 w-10 text-blue-500" />
              </div>
            )}
            <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-slate-200 hover:bg-gray-50 text-slate-600">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-900">Profile Photo</h3>
            <p className="text-sm text-slate-500 mb-2">
              This will be displayed on your profile and shared with other users.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
                placeholder="https://example.com/avatar.jpg"
                className="text-sm border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 w-64 p-2 border"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Information */}
          <section className="space-y-6">
            <h3 className="text-lg font-medium text-slate-900 flex items-center">
              <User className="h-5 w-5 mr-2 text-slate-400" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Bio</label>
                <textarea
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-slate-300 rounded-md p-2"
                  placeholder="Tell us a bit about yourself..."
                />
              </div>
            </div>
          </section>

          {/* Location & Links */}
          <section className="space-y-6">
            <h3 className="text-lg font-medium text-slate-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-slate-400" />
              Location & Social
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Country</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">City</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Website</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">LinkedIn</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Linkedin className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleChange}
                    placeholder="LinkedIn Profile URL"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Twitter</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Twitter className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleChange}
                    placeholder="@username"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">GitHub</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Github className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="github"
                    value={formData.github}
                    onChange={handleChange}
                    placeholder="GitHub Profile URL"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-slate-200 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Professional Info */}
            <section className="space-y-6">
              <h3 className="text-lg font-medium text-slate-900 flex items-center">
                <Briefcase className="h-5 w-5 mr-2 text-slate-400" />
                Professional Info
              </h3>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">School / Institution</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      name="school"
                      value={formData.school}
                      onChange={handleChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Position / Role</label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.position}
                    disabled
                    placeholder="User Role (e.g. Creator, Student)"
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Years of Experience</label>
                  <input
                    type="number"
                    name="yearsOfExperience"
                    min="0"
                    max="50"
                    value={formData.yearsOfExperience}
                    onChange={handleChange}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                  />
                </div>
              </div>
            </section>

            {/* Tags & Lists */}
            <section className="space-y-6">
              <h3 className="text-lg font-medium text-slate-900 flex items-center">
                <Award className="h-5 w-5 mr-2 text-slate-400" />
                Skills & Qualifications
              </h3>

              {/* Specializations */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Specializations</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSpecialization}
                    onChange={(e) => setNewSpecialization(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem("specializations", newSpecialization, setNewSpecialization))}
                    placeholder="Add specialization..."
                    className="flex-1 text-sm border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddItem("specializations", newSpecialization, setNewSpecialization)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.specializations.map((item, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem("specializations", index)}
                        className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none"
                      >
                        <span className="sr-only">Remove</span>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Qualifications */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Qualifications</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newQualification}
                    onChange={(e) => setNewQualification(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem("qualifications", newQualification, setNewQualification))}
                    placeholder="Add qualification..."
                    className="flex-1 text-sm border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddItem("qualifications", newQualification, setNewQualification)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.qualifications.map((item, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem("qualifications", index)}
                        className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-green-400 hover:bg-green-200 hover:text-green-500 focus:outline-none"
                      >
                        <span className="sr-only">Remove</span>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Teaching Areas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Teaching Areas</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTeachingArea}
                    onChange={(e) => setNewTeachingArea(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem("teachingAreas", newTeachingArea, setNewTeachingArea))}
                    placeholder="Add teaching area..."
                    className="flex-1 text-sm border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddItem("teachingAreas", newTeachingArea, setNewTeachingArea)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.teachingAreas.map((item, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem("teachingAreas", index)}
                        className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-purple-400 hover:bg-purple-200 hover:text-purple-500 focus:outline-none"
                      >
                        <span className="sr-only">Remove</span>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

            </section>
          </div>
        </div>
      </div>
    </div>
  );
};