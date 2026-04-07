import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, PassengerProfile, RideStatus, Message, NewRouteSuggestion, RideCurrentStatus, AppState, RideOption, DriverProfile, AuraResponse } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import useSpeechSynthesis from './hooks/useSpeechSynthesis';
import { INITIAL_PASSENGER_PROFILE, INITIAL_RIDE_STATUS, INITIAL_DRIVER_PROFILE } from './constants';
import { getAuraResponse, getVisionDescription } from './services/geminiService';
import { sendSms } from './services/smsService';
import { triggerHaptic, hapticPatterns } from './services/hapticService';
import PassengerView from './components/views/PassengerView';
import DriverView from './components/views/DriverView';
import CaregiverView from './components/views/CaregiverView';
import BookingView from './components/views/BookingView';
import ConfirmationView from './components/views/ConfirmationView';
import WaitingView from './components/views/WaitingView';
import AuthView from './components/views/AuthView';
import { l } from './services/localization';
import { FaUser, FaUserCog, FaUserNurse } from 'react-icons/fa';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [currentUserRole, setCurrentUserRole] = useLocalStorage<UserRole>('aura_userRole', UserRole.PASSENGER);
  const [passengerProfile, setPassengerProfile] = useLocalStorage<PassengerProfile>('aura_passengerProfile', INITIAL_PASSENGER_PROFILE);
  const [driverProfile, setDriverProfile] = useLocalStorage<DriverProfile>('aura_driverProfile', INITIAL_DRIVER_PROFILE);
  const [rideStatus, setRideStatus] = useState<RideStatus>(INITIAL_RIDE_STATUS);
  const [messageLog, setMessageLog] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVisionProcessing, setIsVisionProcessing] = useState(false);
  const [newRouteSuggestion, setNewRouteSuggestion] = useState<NewRouteSuggestion | null>(null);
  const [visionRequestTrigger, setVisionRequestTrigger] = useState(0);
  const [halfwayNotified, setHalfwayNotified] = useState(false);
  const [arrivingNotified, setArrivingNotified] = useState(false);
  const [isVisionOnCooldown, setIsVisionOnCooldown] = useState(false);
  const [isVisionFeatureActive, setIsVisionFeatureActive] = useState(false);
  const [isVisionPaused, setIsVisionPaused] = useState(false);
  const [latestVisionDescription, setLatestVisionDescription] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const visionCooldownTimer = useRef<number | null>(null);
  const abortVisionRef = useRef<boolean>(false);

  const [bookingDetails, setBookingDetails] = useState<{ rideOption: RideOption | null, pickup: string, destination: string }>({ rideOption: null, pickup: '', destination: '' });

  const { speak, cancel, isSpeaking } = useSpeechSynthesis();
  const T = l(passengerProfile.preferences.language);
  const { voiceOutput, language, voiceSpeed, hapticFeedback } = passengerProfile.preferences;

  const speakAuraResponse = useCallback((auraData: Partial<AuraResponse>) => {
    if (!voiceOutput) return;

    let fullText = auraData.response_text || '';
    
    if (auraData.driver_instruction) {
      fullText += `. ${T('attentionDriver')}: ${auraData.driver_instruction}`;
    }
    
    if (auraData.caregiver_alert) {
      fullText += `. ${T('caregiverAlert')}: ${auraData.caregiver_alert}`;
    }

    if (fullText) {
      speak(fullText, language, voiceSpeed);
    }
  }, [voiceOutput, language, voiceSpeed, speak, T]);

  const postAuraSystemMessage = useCallback((text: string, auraData: Partial<Message['auraData']> = {}) => {
    const auraMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'aura',
      text: text,
      timestamp: new Date(),
      auraData: {
        intent: 'INFO',
        response_text: text,
        driver_instruction: auraData.driver_instruction || null,
        caregiver_alert: auraData.caregiver_alert || null,
      },
    };
    setMessageLog(prev => [...prev, auraMessage]);

    speakAuraResponse(auraMessage.auraData!);

    if (hapticFeedback) {
      navigator.vibrate?.([50, 50, 50]);
    }
  }, [speakAuraResponse, hapticFeedback]);
  
  const prevAppStateRef = useRef<AppState | undefined>(undefined);
  useEffect(() => {
    prevAppStateRef.current = appState;
  });
  const prevAppState = prevAppStateRef.current;

  // Skip AUTH if profile is already set up
  useEffect(() => {
    if (appState === AppState.AUTH && passengerProfile.name !== 'Alex') {
      setAppState(AppState.BOOKING);
    }
  }, []); // Only on mount
  
  const [trafficFactor, setTrafficFactor] = useState(1);
  const lastTrafficAlertTime = useRef<number>(0);

  useEffect(() => {
    if (appState !== AppState.IN_RIDE) return;

    const timer = setInterval(() => {
      setRideStatus(prev => {
        if (prev.status === RideCurrentStatus.IN_PROGRESS && prev.etaMinutes > 0) {
          // Simulate traffic affecting ETA
          // 20% chance of traffic delay
          const isTrafficDelay = Math.random() < 0.2;
          if (isTrafficDelay) {
            setTrafficFactor(1.5);
            return { ...prev, etaMinutes: prev.etaMinutes }; // No progress this tick
          } else {
            setTrafficFactor(1);
            return { ...prev, etaMinutes: prev.etaMinutes - 1 };
          }
        }
        if (prev.status === RideCurrentStatus.IN_PROGRESS && prev.etaMinutes <= 0) {
          setAppState(AppState.FINISHED);
          return { ...prev, status: RideCurrentStatus.FINISHED, etaMinutes: 0 };
        }
        return prev;
      });
    }, 10000); // Slower progress update

    return () => clearInterval(timer);
  }, [appState]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (visionCooldownTimer.current) {
        window.clearTimeout(visionCooldownTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
        appState === AppState.IN_RIDE &&
        !halfwayNotified &&
        rideStatus.etaMinutes <= rideStatus.totalTripMinutes / 2 &&
        rideStatus.etaMinutes > 0
    ) {
        if (passengerProfile.caregiverContact && passengerProfile.caregiverNotifications.etaUpdates) {
            const message = `Aura ETA Update: ${passengerProfile.name} is about halfway to their destination. New ETA: ${rideStatus.etaMinutes} minutes.`;
            sendSms(passengerProfile.caregiverContact, message);
        }
        postAuraSystemMessage(`We are now halfway to ${rideStatus.destination}. Everything is on schedule.`);
        setHalfwayNotified(true);
    }
  }, [appState, rideStatus, halfwayNotified, passengerProfile, postAuraSystemMessage]);

  useEffect(() => {
    if (
        appState === AppState.IN_RIDE &&
        !arrivingNotified &&
        rideStatus.etaMinutes <= 2 &&
        rideStatus.etaMinutes > 0
    ) {
        postAuraSystemMessage(`We are arriving at ${rideStatus.destination} in about 2 minutes. Please prepare to exit.`);
        setArrivingNotified(true);
    }
  }, [appState, rideStatus.etaMinutes, arrivingNotified, rideStatus.destination, postAuraSystemMessage]);

  const handleBooking = (rideOption: RideOption, pickup: string, destination: string) => {
    setBookingDetails({ rideOption, pickup, destination });
    setAppState(AppState.CONFIRMING);
  };

  const handleConfirm = () => {
    if (!bookingDetails.rideOption || !bookingDetails.destination || !bookingDetails.pickup) return;
    
    const totalTripMinutes = 30;
    setRideStatus({
      ...INITIAL_RIDE_STATUS,
      pickup: bookingDetails.pickup,
      destination: bookingDetails.destination,
      totalTripMinutes: totalTripMinutes,
      etaMinutes: totalTripMinutes,
      status: RideCurrentStatus.IN_PROGRESS,
    });
    setHalfwayNotified(false);
    setArrivingNotified(false);
    setAppState(AppState.WAITING);
  };

  useEffect(() => {
    if (trafficFactor > 1 && appState === AppState.IN_RIDE && Date.now() - lastTrafficAlertTime.current > 60000) {
      postAuraSystemMessage("I've detected some heavy traffic ahead. Our ETA might be slightly delayed, but don't worry, we're still on the best route.");
      lastTrafficAlertTime.current = Date.now();
    }
  }, [trafficFactor, appState, postAuraSystemMessage]);
  
  const handleDescribeSurroundings = async (base64Image: string) => {
    if (isVisionProcessing || isVisionOnCooldown || !isVisionFeatureActive || isVisionPaused) return;
    setIsVisionProcessing(true);
    abortVisionRef.current = false;
    
    const description = await getVisionDescription(base64Image, passengerProfile);
    
    if (abortVisionRef.current || !isVisionFeatureActive || isVisionPaused) {
      setIsVisionProcessing(false);
      return;
    }

    if (description.includes("high volume of requests")) {
      postAuraSystemMessage(description);
      setIsVisionOnCooldown(true);
      if (visionCooldownTimer.current) {
        window.clearTimeout(visionCooldownTimer.current);
      }
      visionCooldownTimer.current = window.setTimeout(() => {
        setIsVisionOnCooldown(false);
        postAuraSystemMessage("You can now try describing your surroundings again.");
      }, 30000);
    } else {
      postAuraSystemMessage(`Here's what I see: ${description}`);
      setLatestVisionDescription(description);
    }
    
    setIsVisionProcessing(false);
  };

  useEffect(() => {
    let interval: number | null = null;
    if (isVisionFeatureActive && !isVisionPaused && appState === AppState.IN_RIDE) {
      // Trigger immediately when activated
      setVisionRequestTrigger(Date.now());
      
      interval = window.setInterval(() => {
        // We use the latest values from the closure-safe way (adding them to deps)
        if (isVisionFeatureActive && !isVisionPaused && !isVisionProcessing && !isVisionOnCooldown) {
          setVisionRequestTrigger(Date.now());
        }
      }, 30000); // 30 second interval
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isVisionFeatureActive, isVisionPaused, appState, isVisionProcessing, isVisionOnCooldown]);

  useEffect(() => {
    if (appState === AppState.IN_RIDE && prevAppState === AppState.WAITING) {
      const welcomeMessage = `Hello ${passengerProfile.name}, your ride to ${rideStatus.destination} is starting now. Please fasten your seatbelt. I'm Aura, your in-ride assistant. If you need anything, just ask.`;
      postAuraSystemMessage(welcomeMessage);
      
      if (passengerProfile.caregiverContact && passengerProfile.caregiverNotifications.rideStartEnd) {
        const trackingId = Math.random().toString(36).substring(7);
        const trackingLink = `${window.location.origin}/track/${trackingId}`;
        const message = `Aura Ride Start: ${passengerProfile.name} is en route to ${rideStatus.destination}. Track ride: ${trackingLink}`;
        sendSms(passengerProfile.caregiverContact, message);
      }
    }
  }, [appState, prevAppState, passengerProfile, rideStatus.destination, postAuraSystemMessage]);
  
  useEffect(() => {
    if (appState === AppState.FINISHED && prevAppState === AppState.IN_RIDE) {
        postAuraSystemMessage(`We have arrived safely at ${rideStatus.destination}. Thank you for riding with Aura.`);
        if (passengerProfile.caregiverContact && passengerProfile.caregiverNotifications.rideStartEnd) {
            const message = `Aura Ride Complete: ${passengerProfile.name} has arrived safely at ${rideStatus.destination}.`;
            sendSms(passengerProfile.caregiverContact, message);
        }
    }
  }, [appState, prevAppState, passengerProfile, rideStatus.destination, postAuraSystemMessage]);


  const handleEmergency = () => {
    if (rideStatus.status === RideCurrentStatus.EMERGENCY) return;
    setRideStatus(prev => ({...prev, status: RideCurrentStatus.EMERGENCY}));

    const driverInstruction = "EMERGENCY: Passenger requires immediate assistance. Pull over when safe.";
    const caregiverAlert = "EMERGENCY: Passenger has activated the SOS button.";

    postAuraSystemMessage(T('emergencyConfirmed'), {
        driver_instruction: driverInstruction,
        caregiver_alert: caregiverAlert
    });

    if (passengerProfile.caregiverContact && passengerProfile.caregiverNotifications.emergencyAlerts) {
      const locationStr = currentLocation 
        ? `Location: https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`
        : "Location: Unknown (GPS unavailable)";
      
      const needsStr = passengerProfile.assistanceNeeds.length > 0
        ? `Assistance Needs: ${passengerProfile.assistanceNeeds.join(', ')}`
        : "No specific assistance needs listed.";

      const message = `AURA EMERGENCY ALERT!
Passenger: ${passengerProfile.name}
Status: SOS Activated
${locationStr}
Destination: ${rideStatus.destination}
${needsStr}
Please check on them immediately.`;

      sendSms(passengerProfile.caregiverContact, message);
    }
  }

  const handleRouteDecision = (accept: boolean) => {
    if (accept && newRouteSuggestion) {
      setRideStatus(prev => ({
        ...prev,
        etaMinutes: newRouteSuggestion.etaMinutes,
        totalTripMinutes: newRouteSuggestion.etaMinutes,
        routeDescription: newRouteSuggestion.description,
        status: RideCurrentStatus.IN_PROGRESS,
      }));
      postAuraSystemMessage(T('routeAccepted'));
    } else {
      setRideStatus(prev => ({...prev, status: RideCurrentStatus.IN_PROGRESS}));
      postAuraSystemMessage(T('routeDeclined'));
    }
    setNewRouteSuggestion(null);
  }

  const stopVision = useCallback(() => {
    cancel();
    setIsVisionProcessing(false);
    setIsVisionPaused(true);
    setLatestVisionDescription(null);
    abortVisionRef.current = true;
    postAuraSystemMessage("Environment Vision Paused");
    
    if (hapticFeedback) {
      navigator.vibrate?.([100, 50, 100]);
    }
  }, [cancel, postAuraSystemMessage, hapticFeedback]);

  const handleCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();

    // Interrupt/Stop commands should work even if isProcessing is true
    if (['stop analysis', 'stop vision', 'stop describing', 'stop describe', 'arrête de décrire', 'arrête l\'analyse', 'விவரிப்பதை நிறுத்து', 'பகுப்பாய்வை நிறுத்து'].some(word => lowerCommand.includes(word))) {
        stopVision();
        return;
    }

    if (isProcessing) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: command, timestamp: new Date() };
    setMessageLog(prev => [...prev, userMessage]);
    
    if (passengerProfile.preferences.hapticFeedback) {
      navigator.vibrate?.(100);
    }
    
    if (rideStatus.status === RideCurrentStatus.ROUTE_SUGGESTION) {
        const acceptWords = ['accept', 'yes', 'confirm', 'ok', 'yep', 'sounds good', 'accepter', 'oui'];
        const declineWords = ['decline', 'no', 'reject', 'nope', 'cancel', 'refuser', 'non'];
        
        if (acceptWords.some(word => lowerCommand.includes(word))) {
            handleRouteDecision(true);
            return;
        }
        if (declineWords.some(word => lowerCommand.includes(word))) {
            handleRouteDecision(false);
            return;
        }
    }

    if (['emergency', 'sos', 'aide-moi', 'urgence'].some(word => lowerCommand.includes(word))) {
        handleEmergency();
        return;
    }

    setIsProcessing(true);
    const auraResponseData = await getAuraResponse(command, passengerProfile, rideStatus);
    
    const auraMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'aura',
      text: auraResponseData.response_text,
      timestamp: new Date(),
      auraData: auraResponseData,
    };
    setMessageLog(prev => [...prev, auraMessage]);
    
    if (auraResponseData.intent === 'DESCRIBE_SURROUNDINGS') {
      setIsVisionPaused(false);
      setIsVisionFeatureActive(true);
      setVisionRequestTrigger(Date.now());
    }
    
    if (auraResponseData.intent === 'ROUTE_SUGGESTION' && auraResponseData.new_route_details) {
        setNewRouteSuggestion(auraResponseData.new_route_details);
        setRideStatus(prev => ({ ...prev, status: RideCurrentStatus.ROUTE_SUGGESTION }));
    }
    
    if (auraResponseData.intent === 'EMERGENCY') {
        setRideStatus(prev => ({...prev, status: RideCurrentStatus.EMERGENCY}));
    }

    speakAuraResponse(auraResponseData);

    if (passengerProfile.preferences.hapticFeedback) {
      navigator.vibrate?.([50, 50, 50]);
    }

    setIsProcessing(false);
  };
  
  const renderCurrentScreen = () => {
    if (currentUserRole !== UserRole.PASSENGER) {
        if (appState === AppState.IN_RIDE || appState === AppState.FINISHED || appState === AppState.WAITING) {
            switch(currentUserRole) {
                case UserRole.DRIVER:
                    return <DriverView 
                        passengerProfile={passengerProfile} 
                        rideStatus={rideStatus} 
                        messageLog={messageLog} 
                        driverProfile={driverProfile}
                        setDriverProfile={setDriverProfile}
                    />;
                case UserRole.CAREGIVER:
                    return <CaregiverView rideStatus={rideStatus} messageLog={messageLog} currentLocation={currentLocation} trafficFactor={trafficFactor} />;
                default: return null;
            }
        } else {
            return <div className="text-center p-10 text-gray-300">Waiting for passenger to start a ride...</div>
        }
    }
    
    switch (appState) {
      case AppState.AUTH:
        return <AuthView passengerProfile={passengerProfile} setPassengerProfile={setPassengerProfile} onComplete={() => setAppState(AppState.BOOKING)} />;
      case AppState.BOOKING:
        return <BookingView passengerProfile={passengerProfile} setPassengerProfile={setPassengerProfile} onBooking={handleBooking} />;
      case AppState.CONFIRMING:
        if (!bookingDetails.rideOption) return null;
        return <ConfirmationView 
            rideOption={bookingDetails.rideOption} 
            pickup={bookingDetails.pickup}
            destination={bookingDetails.destination} 
            onConfirm={handleConfirm}
            onCancel={() => setAppState(AppState.BOOKING)}
            lang={passengerProfile.preferences.language}
            passengerProfile={passengerProfile}
        />;
      case AppState.WAITING:
        return <WaitingView onDriverFound={() => setAppState(AppState.IN_RIDE)} driver={rideStatus.driver} />;
      case AppState.IN_RIDE:
        return <PassengerView
          passengerProfile={passengerProfile}
          setPassengerProfile={setPassengerProfile}
          rideStatus={rideStatus}
          handleCommand={handleCommand}
          isProcessing={isProcessing}
          messageLog={messageLog}
          handleEmergency={handleEmergency}
          newRouteSuggestion={newRouteSuggestion}
          handleRouteDecision={handleRouteDecision}
          handleDescribeSurroundings={handleDescribeSurroundings}
          isVisionProcessing={isVisionProcessing}
          isVisionOnCooldown={isVisionOnCooldown}
          visionRequestTrigger={visionRequestTrigger}
          isSpeaking={isSpeaking}
          onStopSpeaking={cancel}
          currentLocation={currentLocation}
          trafficFactor={trafficFactor}
          isVisionFeatureActive={isVisionFeatureActive}
          setIsVisionFeatureActive={setIsVisionFeatureActive}
          isVisionPaused={isVisionPaused}
          setIsVisionPaused={setIsVisionPaused}
          latestVisionDescription={latestVisionDescription}
          stopVision={stopVision}
        />;
      case AppState.FINISHED:
          return (
            <div className="text-center p-10 flex flex-col justify-center items-center h-[calc(100vh-80px)]">
                <h2 className="text-3xl font-bold mb-4 text-white">Ride Finished!</h2>
                <p className="text-gray-200">You have arrived at {rideStatus.destination}.</p>
                <button onClick={() => {
                    setAppState(AppState.BOOKING);
                    setMessageLog([]);
                }} className="mt-6 px-6 py-3 bg-[rgb(var(--color-accent-purple))] rounded-lg hover:bg-[rgba(var(--color-accent-purple),0.8)] font-bold transition-colors">
                    Book Another Ride
                </button>
            </div>
          );
      default:
        return <BookingView passengerProfile={passengerProfile} setPassengerProfile={setPassengerProfile} onBooking={handleBooking} />;
    }
  };
  
  const roleIcons: Record<UserRole, React.ReactNode> = {
    [UserRole.PASSENGER]: <FaUser/>,
    [UserRole.DRIVER]: <FaUserCog/>,
    [UserRole.CAREGIVER]: <FaUserNurse/>
  }

  return (
    <div className={`min-h-screen w-full text-white ${passengerProfile.preferences.largeFont ? 'large-font' : ''} contrast-${(passengerProfile.preferences.contrast || 'Normal').toLowerCase()} colorblind-${(passengerProfile.preferences.colorBlindness || 'None').toLowerCase()}`}>
       <div className="min-h-screen w-full">
        <header className="p-4 bg-black/20 backdrop-blur-md flex justify-between items-center shadow-lg sticky top-0 z-40 border-b border-white/10">
          <h1 className="text-xl md:text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-[rgb(var(--color-accent-aqua))] to-[rgb(var(--color-accent-purple))]">Aura</h1>
            <div className="flex items-center space-x-4">
                <div className="flex space-x-1 p-1 bg-black/20 rounded-lg border border-white/10">
                    {Object.values(UserRole).map(role => (
                    <button 
                        key={role}
                        onClick={() => setCurrentUserRole(role)}
                        className={`px-3 py-1.5 rounded-md text-sm md:text-base font-semibold flex items-center space-x-2 transition-all duration-300 ${currentUserRole === role ? 'bg-[rgb(var(--color-accent-purple))] text-white shadow-md' : 'text-gray-300 hover:bg-white/10'}`}
                    >
                    {roleIcons[role]} <span className="hidden md:inline">{T(role.toLowerCase())}</span>
                    </button>
                    ))}
                </div>
            </div>
        </header>
        <main>
          {renderCurrentScreen()}
        </main>
       </div>
    </div>
  );
};

export default App;