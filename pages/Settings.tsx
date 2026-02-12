import React from 'react';
import { User, BookOpen, Download, CreditCard, CloudUpload, CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Manage your account settings and teaching preferences.</p>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
        <aside className="py-6 px-2 sm:px-6 lg:py-0 lg:px-0 lg:col-span-3">
            <nav className="space-y-1">
                {[
                    {name: 'Account', icon: User, current: false},
                    {name: 'Teaching Preferences', icon: BookOpen, current: true},
                    {name: 'Export Preferences', icon: Download, current: false},
                    {name: 'Billing & Plan', icon: CreditCard, current: false},
                ].map(item => (
                    <a key={item.name} href="#" className={`group border-l-4 flex items-center px-3 py-3 text-sm font-medium ${item.current ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-transparent text-slate-900 hover:bg-slate-50 hover:text-blue-700'}`}>
                        <item.icon size={20} className={`mr-3 -ml-1 ${item.current ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
                        <span className="truncate">{item.name}</span>
                    </a>
                ))}
            </nav>
        </aside>

        <div className="space-y-6 sm:px-6 lg:px-0 lg:col-span-9">
            <form>
                {/* Branding */}
                <div className="bg-white shadow-sm sm:rounded-xl border border-slate-200 overflow-hidden mb-6">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="md:grid md:grid-cols-3 md:gap-6">
                            <div className="md:col-span-1">
                                <h3 className="text-lg font-medium leading-6 text-slate-900">Institution Branding</h3>
                                <p className="mt-1 text-sm text-slate-500">This information will appear on the header of all your generated teaching documents.</p>
                            </div>
                            <div className="mt-5 md:mt-0 md:col-span-2 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Institution Name</label>
                                    <input type="text" className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="e.g. St. Mary's School of Nursing"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Logo (Optional)</label>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-blue-500 hover:bg-slate-50 transition-all cursor-pointer">
                                        <div className="space-y-1 text-center">
                                            <CloudUpload className="mx-auto h-12 w-12 text-slate-400" />
                                            <div className="flex text-sm text-slate-600">
                                                <span className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">Upload a file</span>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-slate-500">PNG, JPG, GIF up to 2MB</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Curriculum Defaults */}
                <div className="bg-white shadow-sm sm:rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="md:grid md:grid-cols-3 md:gap-6">
                            <div className="md:col-span-1">
                                <h3 className="text-lg font-medium leading-6 text-slate-900">Curriculum Defaults</h3>
                                <p className="mt-1 text-sm text-slate-500">Set your default parameters to speed up lesson plan generation.</p>
                            </div>
                            <div className="mt-5 md:mt-0 md:col-span-2 space-y-6">
                                <fieldset>
                                    <legend className="text-sm font-medium text-slate-700">Core Programme</legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                        <label className="relative flex cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm focus:outline-none ring-2 ring-blue-600">
                                            <input type="radio" name="prog" className="sr-only" defaultChecked />
                                            <span className="flex flex-1">
                                                <span className="flex flex-col">
                                                    <span className="block text-sm font-medium text-slate-900">Nursing</span>
                                                    <span className="mt-1 flex items-center text-xs text-slate-500">General, Adult, Child</span>
                                                </span>
                                            </span>
                                            <CheckCircle className="text-blue-600 h-5 w-5" />
                                        </label>
                                        <label className="relative flex cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50">
                                            <input type="radio" name="prog" className="sr-only" />
                                            <span className="flex flex-1">
                                                <span className="flex flex-col">
                                                    <span className="block text-sm font-medium text-slate-900">Midwifery</span>
                                                    <span className="mt-1 flex items-center text-xs text-slate-500">Pre/Post Registration</span>
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                </fieldset>

                                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                    <div className="sm:col-span-4">
                                        <label className="block text-sm font-medium text-slate-700">Preferred Lesson Plan Format</label>
                                        <div className="mt-1">
                                            <select className="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm bg-white border">
                                                <option>Standard (NMC Aligned)</option>
                                                <option>Gagne's 9 Events</option>
                                                <option>5E Model</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700">Default Duration</label>
                                        <div className="mt-1 relative rounded-md shadow-sm">
                                            <input type="number" className="block w-full rounded-md border-slate-300 pl-3 pr-12 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm border" placeholder="60" defaultValue={60}/>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <span className="text-slate-500 sm:text-sm">min</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button type="button" className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm">Save Preferences</button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
