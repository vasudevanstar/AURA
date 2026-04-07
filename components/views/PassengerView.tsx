import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaMicrophone, FaPaperPlane, FaSpinner, FaExclamationTriangle, FaMicrophoneSlash, FaEye, FaCamera, FaPhoneAlt, FaUserShield, FaTimes, FaStop } from 'react-icons/fa';
import { PassengerProfile, RideStatus, SpeechRecognitionStatus, Message, NewRouteSuggestion, RideCurrentStatus, Language } from '../../types';
import StatusCard from '../StatusCard';
import LiveMap from '../LiveMap';
import AccessibilityPanel from '../AccessibilityPanel';
import SignLanguagePlayer from '../SignLanguagePlayer';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import Card from '../ui/Card';
import { l } from '../../services/localization';
import { QUICK_ACTIONS } from '../../constants';
import ProgressBar from '../ui/ProgressBar';
import CameraFeed, { CameraFeedHandle } from '../CameraFeed';

const EmergencyModal: React.FC<{ isOpen: boolean; onClose: () => void; caregiverContact?: string; currentLocation: { lat: number; lng: number } | null; }> = ({ isOpen, onClose, caregiverContact, currentLocation }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(var(--color-accent-red),0.8)] backdrop-blur-sm flex flex-col justify-center items-center z-50 p-4 text-white text-center" role="alertdialog" aria-modal="true" aria-labelledby="emergency-title">
      <div className="absolute inset-0 bg-black/20 animate-pulse"></div>
      <FaExclamationTriangle className="text-7xl text-white drop-shadow-lg mb-6" />
      <h1 id="emergency-title" className="text-4xl md:text-6xl font-extrabold mb-4 animate-pulse">EMERGENCY ACTIVATED</h1>
      <p className="text-lg md:text-xl mb-4">The driver and your caregiver have been notified.</p>
      
      {currentLocation && (
        <div className="bg-black/30 p-3 rounded-lg mb-6 z-10 border border-white/10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Your Current Location</p>
          <p className="font-mono text-sm">{currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</p>
        </div>
      )}
      
      <div className="w-full max-w-sm space-y-4 z-10">
        {caregiverContact && (
            <a href={`tel:${caregiverContact}`} className="w-full flex items-center justify-center p-4 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors font-bold text-white text-xl shadow-lg">
                <FaUserShield className="mr-3 text-2xl" />
                Call Caregiver
            </a>
        )}
        <a href="tel:911" className="w-full flex items-center justify-center p-4 rounded-lg bg-yellow-500 hover:bg-yellow-600 transition-colors font-bold text-black text-xl shadow-lg">
            <FaPhoneAlt className="mr-3 text-2xl" />
            Call Emergency Services
        </a>
      </div>
      
      <button onClick={onClose} className="mt-12 flex items-center justify-center p-3 rounded-lg bg-white/20 hover:bg-white/30 font-semibold z-10" aria-label="Dismiss this message">
          <FaTimes className="mr-2" />
          Dismiss
      </button>
    </div>
  );
};


interface PassengerViewProps {
  passengerProfile: PassengerProfile;
  setPassengerProfile: React.Dispatch<React.SetStateAction<PassengerProfile>>;
  rideStatus: RideStatus;
  handleCommand: (command: string) => Promise<void>;
  isProcessing: boolean;
  messageLog: Message[];
  handleEmergency: () => void;
  newRouteSuggestion: NewRouteSuggestion | null;
  handleRouteDecision: (accept: boolean) => void;
  handleDescribeSurroundings: (base64Image: string) => void;
  isVisionProcessing: boolean;
  isVisionOnCooldown: boolean;
  visionRequestTrigger: number;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  currentLocation: { lat: number; lng: number } | null;
  trafficFactor?: number;
  isVisionFeatureActive: boolean;
  setIsVisionFeatureActive: React.Dispatch<React.SetStateAction<boolean>>;
  isVisionPaused: boolean;
  setIsVisionPaused: React.Dispatch<React.SetStateAction<boolean>>;
  latestVisionDescription: string | null;
  stopVision: () => void;
}

const PassengerView: React.FC<PassengerViewProps> = ({ 
    passengerProfile, 
    setPassengerProfile, 
    rideStatus,
    handleCommand,
    isProcessing,
    messageLog,
    handleEmergency,
    newRouteSuggestion,
    handleRouteDecision,
    handleDescribeSurroundings,
    isVisionProcessing,
    isVisionOnCooldown,
    visionRequestTrigger,
    isSpeaking,
    onStopSpeaking,
    currentLocation,
    trafficFactor = 1,
    isVisionFeatureActive,
    setIsVisionFeatureActive,
    isVisionPaused,
    setIsVisionPaused,
    latestVisionDescription,
    stopVision
}) => {
  const [textInput, setTextInput] = useState('');
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const langCode = passengerProfile.preferences.language;
  
  const speechRecLanguageMap: Record<Language, string> = {
    [Language.EN]: 'en-US',
    [Language.FR]: 'fr-FR',
    [Language.TA]: 'ta-IN',
  };
  const langForSpeechRec = speechRecLanguageMap[langCode] || 'en-US';

  const { isSupported, status, startListening, stopListening, transcript, interimTranscript, permission } = useSpeechRecognition(langForSpeechRec, handleCommand);
  const T = l(passengerProfile.preferences.language);
  const micPermissionDenied = permission === 'denied';
  const prevStatusRef = useRef<SpeechRecognitionStatus | null>(null);

  const lastAuraMessage = messageLog.filter(m => m.sender === 'aura').pop();
  const lastUserMessage = messageLog.filter(m => m.sender === 'user').pop();

  const progress = rideStatus.totalTripMinutes > 0
    ? ((rideStatus.totalTripMinutes - rideStatus.etaMinutes) / rideStatus.totalTripMinutes) * 100
    : (rideStatus.status === RideCurrentStatus.FINISHED ? 100 : 0);
  
  useEffect(() => {
    if (transcript && status === 'processing') {
      setTextInput(transcript);
      // handleCommand is already called by useSpeechRecognition callback
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, status]);

  useEffect(() => {
    if (interimTranscript) {
      setTextInput(interimTranscript);
    }
  }, [interimTranscript]);

  useEffect(() => {
    if (rideStatus.status === RideCurrentStatus.EMERGENCY) {
      setIsEmergencyModalOpen(true);
      if (passengerProfile.preferences.hapticFeedback) {
        navigator.vibrate?.([200, 100, 200, 100, 200]); // SOS haptic
      }
    }
  }, [rideStatus.status, passengerProfile.preferences.hapticFeedback]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    if (passengerProfile.preferences.hapticFeedback) {
      if (status === 'listening' && prevStatus !== 'listening') {
        navigator.vibrate?.(50);
      }
      if (status !== 'listening' && prevStatus === 'listening') {
        navigator.vibrate?.(25);
      }
    }
    prevStatusRef.current = status;
  }, [status, passengerProfile.preferences.hapticFeedback]);

  const handleSend = () => {
    if (textInput.trim()) {
      stopListening();
      handleCommand(textInput);
      setTextInput('');
    }
  };

  const handleCaptureAndDescribe = useCallback(() => {
    if (isVisionProcessing || isVisionOnCooldown || !isVisionFeatureActive || isVisionPaused) return;
    const imageData = cameraRef.current?.captureFrame();
    if (imageData) {
        handleDescribeSurroundings(imageData);
    } else {
        console.error("Failed to capture frame from camera.");
    }
  }, [isVisionProcessing, isVisionOnCooldown, isVisionFeatureActive, isVisionPaused, handleDescribeSurroundings]);

  useEffect(() => {
    if (visionRequestTrigger > 0) {
      setIsVisionFeatureActive(true);
      // Wait for camera to initialize before capturing
      const timer = setTimeout(() => {
        handleCaptureAndDescribe();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [visionRequestTrigger, handleCaptureAndDescribe]);
  
  const handlePreferencesChange = useCallback(<K extends keyof PassengerProfile['preferences']>(
    key: K, 
    value: PassengerProfile['preferences'][K]
  ) => {
    setPassengerProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }));
  }, [setPassengerProfile]);

  const getMicButtonState = () => {
    if (micPermissionDenied) {
      return { icon: <FaMicrophoneSlash />, text: T('micPermissionNeeded'), color: 'bg-[rgb(var(--color-accent-red))]', disabled: true };
    }
    switch (status) {
      case 'listening': return { icon: <FaMicrophone />, text: T('listening'), color: 'bg-yellow-500 animate-pulse', disabled: false };
      case 'processing': return { icon: <FaSpinner className="animate-spin" />, text: T('processing'), color: 'bg-[rgb(var(--color-accent-aqua))]', disabled: true };
      case 'error':
        return { icon: <FaExclamationTriangle />, text: T('error'), color: 'bg-[rgb(var(--color-accent-red))]', disabled: false };
      default: return { icon: <FaMicrophone />, text: T('tapToSpeak'), color: 'bg-[rgb(var(--color-accent-purple))]', disabled: isProcessing };
    }
  };
  const micButtonState = getMicButtonState();

  const isVisionBusy = isVisionProcessing || isVisionOnCooldown;
  const visionButtonText = isVisionProcessing
    ? 'Analyzing...'
    : isVisionOnCooldown
    ? 'On Cooldown...'
    : 'Describe Surroundings';

  return (
    <div className="p-2 md:p-4 space-y-4 text-white pb-40">
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        caregiverContact={passengerProfile.caregiverContact}
        currentLocation={currentLocation}
      />
      <StatusCard rideStatus={rideStatus} lang={passengerProfile.preferences.language} />
      
      <Card className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-200">{T('tripProgress')}</span>
        <ProgressBar progress={progress} />
        <span className="text-sm font-bold w-12 text-right">{Math.round(progress)}%</span>
      </Card>

      <LiveMap currentLocation={currentLocation} progress={progress} rideStatus={rideStatus} trafficFactor={trafficFactor} />
      
      <Card>
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white flex items-center">
                    <FaEye className="mr-2 text-[rgb(var(--color-accent-aqua))]" />
                    Environmental Vision
                </h3>
                {isVisionPaused && (
                    <span className="text-xs font-bold text-red-400 flex items-center mt-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                        Environment Vision Paused
                    </span>
                )}
            </div>
            <div className="flex space-x-2">
                {isVisionPaused && (
                    <button
                        onClick={() => setIsVisionPaused(false)}
                        className="px-3 py-1.5 text-sm rounded-lg font-semibold bg-green-600 hover:bg-green-700 transition-colors"
                    >
                        Resume Analysis
                    </button>
                )}
                <button
                onClick={() => setIsVisionFeatureActive(prev => !prev)}
                className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-colors ${isVisionFeatureActive ? 'bg-white/10 hover:bg-white/20' : 'bg-[rgb(var(--color-accent-purple))] hover:bg-[rgba(var(--color-accent-purple),0.8)]'}`}
                >
                {isVisionFeatureActive ? 'Hide Camera' : 'Show Camera'}
                </button>
            </div>
        </div>
        {isVisionFeatureActive && (
          <div className="mt-4 space-y-4">
            <div className={`relative rounded-lg overflow-hidden border-4 transition-colors duration-300 ${isVisionPaused ? 'border-red-500/50' : isVisionProcessing ? 'border-[rgb(var(--color-accent-aqua))]' : 'border-white/10'}`}>
                <CameraFeed ref={cameraRef} />
                
                {/* Vision Results Overlay */}
                {!isVisionPaused && latestVisionDescription && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-3 border-t border-white/10 animate-in slide-in-from-bottom-full duration-500">
                        <p className="text-xs font-bold text-[rgb(var(--color-accent-aqua))] uppercase tracking-widest mb-1 flex items-center">
                            <span className="w-2 h-2 bg-[rgb(var(--color-accent-aqua))] rounded-full mr-2 animate-pulse"></span>
                            Latest Observation
                        </p>
                        <p className="text-sm text-white leading-tight">{latestVisionDescription}</p>
                    </div>
                )}

                {isVisionPaused && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center space-y-4">
                        <div className="bg-black/60 px-4 py-2 rounded-full border border-red-500/50 flex items-center">
                            <FaStop className="text-red-500 mr-2" />
                            <span className="text-white font-bold uppercase tracking-widest text-sm">Vision Paused</span>
                        </div>
                        <button
                            onClick={() => setIsVisionPaused(false)}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center"
                        >
                            <FaEye className="mr-2" />
                            Resume Analysis
                        </button>
                    </div>
                )}
            </div>
            <div className="flex space-x-2">
              <button
                  onClick={handleCaptureAndDescribe}
                  disabled={isVisionBusy || isVisionPaused}
                  className="flex-1 flex items-center justify-center p-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500/50 transition-colors font-bold text-white"
              >
                  {isVisionProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaCamera className="mr-2" />}
                  {isVisionPaused ? 'Analysis Paused' : visionButtonText}
              </button>
              {isSpeaking && (
                 <button
                    onClick={onStopSpeaking}
                    className="flex-none w-14 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                    aria-label="Stop Speaking"
                 >
                    <FaStop />
                 </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {newRouteSuggestion && rideStatus.status === RideCurrentStatus.ROUTE_SUGGESTION && (
        <Card className="border-2 border-yellow-400">
            <h3 className="text-lg font-bold text-yellow-300 mb-2">{T('newRouteSuggested')}</h3>
            <p><span className="font-semibold">{newRouteSuggestion.name}:</span> {newRouteSuggestion.description}</p>
            <p className="mt-1">New ETA: <span className="font-bold">{newRouteSuggestion.etaMinutes} {T('minutes')}</span></p>
            <div className="flex justify-end space-x-2 mt-4">
                <button onClick={() => handleRouteDecision(false)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">{T('decline')}</button>
                <button onClick={() => handleRouteDecision(true)} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700">{T('accept')}</button>
            </div>
        </Card>
      )}

      <Card className={`${isProcessing ? 'animate-calm-glow' : ''} relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4 opacity-20">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-[rgb(var(--color-accent-aqua))] to-[rgb(var(--color-accent-purple))] ${isProcessing || isSpeaking ? 'animate-pulse scale-110' : ''}`}></div>
        </div>
        <h3 className="text-lg font-bold mb-2 flex items-center">
          {isProcessing && lastUserMessage ? `You asked:` : (
            <>
              <div className={`w-3 h-3 rounded-full mr-2 ${isSpeaking ? 'bg-[rgb(var(--color-accent-aqua))] animate-ping' : 'bg-[rgb(var(--color-accent-purple))]'}`}></div>
              {T('auraResponse')}
            </>
          )}
        </h3>
        {isProcessing && lastUserMessage && (
          <p className="min-h-[1.5em] text-gray-300 italic mb-2">
            "{lastUserMessage.text}"
          </p>
        )}
        <p className="min-h-[3em] text-gray-200">
          {isProcessing 
            ? <span className="flex items-center text-[rgb(var(--color-accent-aqua))]"><FaSpinner className="animate-spin mr-2"/> {T('processing')}</span>
            : lastAuraMessage?.text || "Hello! How can I help you today?"
          }
        </p>
      </Card>
      
      {/* Quick Actions Row */}
      <Card>
        <h3 className="text-lg font-bold mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS[passengerProfile.preferences.language].map(action => (
                <button key={action.label} onClick={() => handleCommand(action.query)} className="px-3 py-1.5 text-sm bg-black/20 hover:bg-white/20 border border-white/10 rounded-full transition-colors">
                    {action.label}
                </button>
            ))}
        </div>
      </Card>

      {/* Sign Language Row */}
      {passengerProfile.preferences.signLanguage && (
         <div className="mt-4">
             <SignLanguagePlayer text={lastAuraMessage?.text || "Welcome to Aura"} />
         </div>
      )}

      <AccessibilityPanel preferences={passengerProfile.preferences} onPreferencesChange={handlePreferencesChange} />

      {/* Interaction Bar */}
       <div className="fixed bottom-0 left-0 right-0 p-2 bg-black/30 backdrop-blur-md border-t border-white/10 z-30">
        <div className="max-w-4xl mx-auto flex items-center space-x-2">
          <input 
            type="text" 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={T('askAura')}
            className="w-full bg-black/20 border border-white/20 rounded-lg p-3 focus:ring-[rgb(var(--color-accent-purple))] focus:border-[rgb(var(--color-accent-purple))] transition-colors"
            disabled={isProcessing}
          />
          {isSupported ? (
            <div className={`relative rounded-lg ${isSpeaking ? 'animate-voice-pulse' : ''}`}>
              <button
                onClick={() => {
                    if (status === 'listening') stopListening();
                    else if (status === 'idle' || status === 'error') startListening();
                }}
                disabled={micButtonState.disabled}
                className={`flex-shrink-0 w-16 h-12 flex items-center justify-center rounded-lg transition-colors text-white font-bold text-2xl ${micButtonState.color} disabled:bg-gray-500/50 disabled:cursor-not-allowed`}>
                {micButtonState.icon}
              </button>
            </div>
          ) : (
            <button onClick={handleSend} disabled={isProcessing} className="flex-shrink-0 w-16 h-12 flex items-center justify-center bg-[rgb(var(--color-accent-purple))] rounded-lg hover:bg-[rgba(var(--color-accent-purple),0.8)] disabled:bg-gray-500/50 transition-colors">
                <FaPaperPlane />
            </button>
          )}
        </div>
        {micPermissionDenied && (
          <p className="text-xs text-yellow-300 text-center mt-1 px-2">{T('micPermissionInstructions')}</p>
        )}
      </div>

      <button 
        onClick={handleEmergency} 
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 w-20 h-20 rounded-full bg-[rgb(var(--color-accent-red))] text-white flex flex-col items-center justify-center shadow-2xl animate-pulse-red border-4 border-[rgba(var(--color-accent-red),0.5)]"
        aria-label="Activate Emergency SOS"
      >
          <FaExclamationTriangle size={28} />
          <span className="text-sm font-bold mt-1">SOS</span>
      </button>
    </div>
  );
};

export default PassengerView;