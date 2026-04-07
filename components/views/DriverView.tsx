import React, { useState } from 'react';
import { PassengerProfile, Message, RideStatus, Language, RideCurrentStatus, DriverProfile } from '../../types';
import Card from '../ui/Card';
import { 
  FaUserShield, 
  FaClipboardList, 
  FaWifi, 
  FaPowerOff, 
  FaUserCircle, 
  FaCar, 
  FaHistory, 
  FaStar, 
  FaCheckCircle, 
  FaEdit, 
  FaSave,
  FaTools
} from 'react-icons/fa';
import { l } from '../../services/localization';

interface DriverViewProps {
  passengerProfile: PassengerProfile;
  rideStatus: RideStatus;
  messageLog: Message[];
  driverProfile: DriverProfile;
  setDriverProfile: (profile: DriverProfile) => void;
}

const DriverView: React.FC<DriverViewProps> = ({ 
  passengerProfile, 
  rideStatus, 
  messageLog, 
  driverProfile, 
  setDriverProfile 
}) => {
  const [activeTab, setActiveTab] = useState<'ride' | 'profile' | 'history'>('ride');
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<DriverProfile>(driverProfile);

  const T = l(Language.EN);
  const driverInstructions = messageLog
    .map(msg => msg.auraData?.driver_instruction)
    .filter((instr): instr is string => !!instr)
    .reverse();

  const isEmergency = rideStatus.status === RideCurrentStatus.EMERGENCY;

  const handleToggleOnline = () => {
    setDriverProfile({ ...driverProfile, isOnline: !driverProfile.isOnline });
  };

  const handleSaveProfile = () => {
    setDriverProfile(editProfile);
    setIsEditing(false);
  };

  const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex items-center h-7 rounded-full w-12 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-[rgb(var(--color-accent-purple))] ${checked ? 'bg-green-500' : 'bg-gray-600'}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className={`p-4 min-h-screen transition-colors ${isEmergency && driverProfile.isOnline ? 'bg-[rgba(var(--color-accent-red),0.7)]' : 'bg-transparent'}`}>
      
      {/* Role Header & Tabs */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <FaUserCircle className="text-4xl text-gray-400" />
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${driverProfile.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            </div>
            <div>
              <h2 className="font-bold text-white">{driverProfile.name}</h2>
              <div className="flex items-center text-xs text-yellow-400">
                <FaStar className="mr-1" /> {driverProfile.rating} • {driverProfile.totalRides} Rides
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`text-xs font-bold uppercase tracking-widest ${driverProfile.isOnline ? 'text-green-400' : 'text-gray-400'}`}>
              {driverProfile.isOnline ? 'Online' : 'Offline'}
            </span>
            <Toggle checked={driverProfile.isOnline} onChange={handleToggleOnline} />
          </div>
        </div>

        <div className="flex p-1 bg-black/20 rounded-xl border border-white/10">
          <button 
            onClick={() => setActiveTab('ride')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${activeTab === 'ride' ? 'bg-[rgb(var(--color-accent-purple))] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <FaCar /> <span>Active Ride</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${activeTab === 'profile' ? 'bg-[rgb(var(--color-accent-purple))] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <FaUserShield /> <span>Profile</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${activeTab === 'history' ? 'bg-[rgb(var(--color-accent-purple))] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <FaHistory /> <span>History</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'ride' && (
          <>
            {!driverProfile.isOnline ? (
              <Card className="text-center py-12">
                <FaPowerOff className="text-5xl text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">You Are Currently Offline</h2>
                <p className="text-gray-400 mt-2 max-w-xs mx-auto">Go online to start receiving ride requests and assisting passengers.</p>
              </Card>
            ) : (
              <>
                {isEmergency && (
                  <Card className="mb-4 text-center animate-pulse-red text-white border-none">
                    <h2 className="text-3xl font-extrabold uppercase tracking-tighter">Emergency Alert</h2>
                    <p className="text-lg font-medium opacity-90">Passenger has requested immediate assistance.</p>
                  </Card>
                )}
                
                <Card>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <FaUserShield className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
                    <span>Passenger: {passengerProfile.name}</span>
                  </h3>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Assistance Needs</p>
                    {passengerProfile.assistanceNeeds.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {passengerProfile.assistanceNeeds.map((need, index) => (
                          <span key={index} className="px-3 py-1 bg-[rgba(var(--color-accent-aqua),0.1)] text-[rgb(var(--color-accent-aqua))] rounded-full text-xs font-bold border border-[rgba(var(--color-accent-aqua),0.2)]">
                            {need}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-300 italic">No specific needs listed.</p>
                    )}
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <FaClipboardList className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
                    Aura's Instructions
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {driverInstructions.length > 0 ? (
                      driverInstructions.map((instr, index) => (
                        <div key={index} className="bg-black/30 p-4 rounded-xl border-l-4 border-[rgb(var(--color-accent-purple))] shadow-inner">
                          <p className="text-white text-sm leading-relaxed">{instr}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 opacity-40">
                        <FaClipboardList className="text-4xl mx-auto mb-2" />
                        <p className="text-sm">No instructions from Aura yet.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4 pb-20">
            <Card>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <FaCar className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
                  Vehicle Details
                </h3>
                <button 
                  onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                  className={`p-2 rounded-full transition-all ${isEditing ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  {isEditing ? <FaSave /> : <FaEdit />}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Model</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editProfile.vehicle.model}
                      onChange={e => setEditProfile({...editProfile, vehicle: {...editProfile.vehicle, model: e.target.value}})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[rgb(var(--color-accent-purple))]"
                    />
                  ) : (
                    <p className="text-lg font-bold text-white">{driverProfile.vehicle.model}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">License Plate</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editProfile.vehicle.plate}
                        onChange={e => setEditProfile({...editProfile, vehicle: {...editProfile.vehicle, plate: e.target.value}})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[rgb(var(--color-accent-purple))]"
                      />
                    ) : (
                      <p className="text-lg font-bold text-white">{driverProfile.vehicle.plate}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                    {isEditing ? (
                      <select 
                        value={editProfile.vehicle.type}
                        onChange={e => setEditProfile({...editProfile, vehicle: {...editProfile.vehicle, type: e.target.value as any}})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[rgb(var(--color-accent-purple))]"
                      >
                        <option value="Electric">Electric</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Accessible">Accessible</option>
                      </select>
                    ) : (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/30">
                        {driverProfile.vehicle.type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <FaTools className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
                Specializations
              </h3>
              <div className="flex flex-wrap gap-2">
                {driverProfile.specializations.map((spec, index) => (
                  <div key={index} className="flex items-center space-x-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-sm text-gray-200">
                    <FaCheckCircle className="text-green-500" />
                    <span>{spec}</span>
                  </div>
                ))}
                {isEditing && (
                   <button className="px-4 py-2 bg-[rgb(var(--color-accent-purple))]/20 text-[rgb(var(--color-accent-purple))] rounded-xl border border-[rgb(var(--color-accent-purple))]/30 text-sm font-bold hover:bg-[rgb(var(--color-accent-purple))]/30 transition-all">
                    + Add New
                   </button>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 pb-20">
            <h3 className="text-xl font-bold text-white px-2 flex items-center">
              <FaHistory className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
              Recent Trips
            </h3>
            {driverProfile.history.length > 0 ? (
              driverProfile.history.map(trip => (
                <Card key={trip.id} className="group hover:border-[rgb(var(--color-accent-purple))]/50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{trip.date}</p>
                      <h4 className="font-bold text-white text-lg">Passenger: {trip.passengerName}</h4>
                    </div>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-[10px] font-black uppercase tracking-widest border border-green-500/30">
                      {trip.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <p className="truncate">{trip.pickup}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="truncate">{trip.destination}</p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-20 opacity-30">
                <FaHistory className="text-6xl mx-auto mb-4" />
                <p className="text-xl font-bold">No trip history found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverView;
