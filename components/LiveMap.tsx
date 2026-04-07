
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCarSide, FaCheckCircle, FaClock, FaLocationArrow, FaTachometerAlt } from 'react-icons/fa';
import { RideStatus } from '../types';

interface LiveMapProps {
  currentLocation?: { lat: number; lng: number } | null;
  onRefresh?: () => void;
  progress?: number;
  rideStatus?: RideStatus;
  trafficFactor?: number;
}

const LiveMap: React.FC<LiveMapProps> = ({ progress = 0, rideStatus, trafficFactor = 1 }) => {
  const [speed, setSpeed] = useState(42);
  const [distance, setDistance] = useState(15);
  const [eta, setEta] = useState(25);
  const [showArrival, setShowArrival] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

  // SVG Path for the route
  const routePath = "M40,100 C100,20 200,180 360,100";
  
  // Background roads for "abstract" look
  const backgroundRoads = [
    "M0,120 Q100,150 200,100 T400,130",
    "M50,0 Q80,100 30,200",
    "M300,0 Q250,80 350,200",
    "M0,50 C150,20 250,80 400,40"
  ];

  useEffect(() => {
    // Dynamic speed simulation
    const speedInterval = setInterval(() => {
      setSpeed(prev => {
        const baseSpeed = trafficFactor > 1 ? 25 : 42;
        const change = Math.floor(Math.random() * 5) - 2;
        const next = prev + change;
        return Math.max(baseSpeed - 5, Math.min(baseSpeed + 5, next));
      });
    }, 2000);

    return () => clearInterval(speedInterval);
  }, [trafficFactor]);

  useEffect(() => {
    // Update distance and ETA based on progress or rideStatus
    if (rideStatus) {
      setDistance(parseFloat((rideStatus.etaMinutes * 0.5).toFixed(1))); // Rough estimate: 0.5km per minute
      setEta(rideStatus.etaMinutes);
    } else {
      const remainingDist = Math.max(0, 15 * (1 - progress / 100));
      const remainingEta = Math.max(0, Math.round(25 * (1 - progress / 100)));
      setDistance(parseFloat(remainingDist.toFixed(1)));
      setEta(remainingEta);
    }

    if (progress >= 100 && !hasArrived) {
      setHasArrived(true);
      setShowArrival(true);
      setTimeout(() => setShowArrival(false), 5000);
    } else if (progress < 100) {
      setHasArrived(false);
    }
  }, [progress, hasArrived, rideStatus]);

  return (
    <div className="w-full relative group">
      {/* Main Map Container */}
      <div className="w-full h-[300px] md:h-[400px] rounded-[24px] bg-[#0A0F1E] overflow-hidden relative border border-white/10 shadow-2xl transition-all duration-500">
        
        {/* Background Gradient & Grid */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1E] via-[#111827] to-[#0F172A] opacity-90"></div>
        <div className="absolute inset-0" style={{ 
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }}></div>

        {/* Abstract Background Roads */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
          {backgroundRoads.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          ))}
        </svg>

        {/* Live Tracking SVG Layer */}
        <svg className="absolute inset-0 w-full h-full p-10" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={trafficFactor > 1 ? "#F59E0B" : "#10B981"} />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Static Route Shadow */}
          <path d={routePath} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round" />
          
          {/* Traffic Indicators */}
          {trafficFactor > 1 && (
            <motion.path
              d={routePath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="opacity-20"
            />
          )}

          {/* Animated Route Path */}
          <motion.path 
            d={routePath} 
            fill="none" 
            stroke="url(#routeGradient)" 
            strokeWidth="4" 
            strokeLinecap="round"
            strokeDasharray="1 10"
            animate={{ strokeDashoffset: trafficFactor > 1 ? [0, -10] : [0, -20] }}
            transition={{ duration: trafficFactor > 1 ? 2 : 1, repeat: Infinity, ease: "linear" }}
            className="opacity-40"
          />

          {/* Start Marker */}
          <g transform="translate(40, 100)">
            <motion.circle 
              r="12" 
              fill="rgba(16, 185, 129, 0.2)"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <circle r="6" fill="#10B981" filter="url(#glow)" />
            <text y="25" textAnchor="middle" fill="#10B981" className="text-[10px] font-bold uppercase tracking-widest">Start Point</text>
          </g>

          {/* Destination Marker */}
          <g transform="translate(360, 100)">
            <motion.circle 
              r="12" 
              fill="rgba(239, 68, 68, 0.2)"
              animate={{ scale: hasArrived ? [1, 2, 1] : 1 }}
              transition={{ duration: 0.5, repeat: hasArrived ? 3 : 0 }}
            />
            <circle r="6" fill="#EF4444" filter="url(#glow)" />
            <text y="25" textAnchor="middle" fill="#EF4444" className="text-[10px] font-bold uppercase tracking-widest">Destination</text>
          </g>

          {/* Moving Vehicle */}
          <motion.g
            style={{ 
              offsetPath: `path("${routePath}")`,
              offsetDistance: `${progress}%`,
              offsetRotate: 'auto'
            }}
          >
            {/* Vehicle Trail */}
            <circle r="8" fill="rgba(59, 130, 246, 0.3)" filter="url(#glow)" />
            
            {/* Vehicle Icon */}
            <foreignObject x="-15" y="-15" width="30" height="30">
              <div className="flex items-center justify-center w-full h-full">
                <FaCarSide className="text-white text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </div>
            </foreignObject>
          </motion.g>
        </svg>

        {/* Live Tracking Info Panel (Top-Right) */}
        <div className="absolute top-5 right-5 z-30 w-48 md:w-56">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <FaTachometerAlt className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Speed</span>
              </div>
              <span className={`text-sm font-mono font-bold ${trafficFactor > 1 ? 'text-yellow-400' : 'text-white'}`}>
                {speed} <span className="text-[10px] text-gray-500">km/h</span>
              </span>
            </div>
            
            <div className="h-px bg-white/5"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <FaLocationArrow className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Distance</span>
              </div>
              <span className="text-sm font-mono font-bold text-[rgb(var(--color-accent-aqua))]">{distance} <span className="text-[10px] text-gray-500">km</span></span>
            </div>

            <div className="h-px bg-white/5"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <FaClock className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">ETA</span>
              </div>
              <span className="text-sm font-mono font-bold text-[rgb(var(--color-accent-purple))]">{eta} <span className="text-[10px] text-gray-500">min</span></span>
            </div>
          </div>
          
          {trafficFactor > 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-2 bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 rounded-xl p-2 flex items-center space-x-2"
            >
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wider">Heavy Traffic Detected</span>
            </motion.div>
          )}
        </div>

        {/* Arrival Notification Popup */}
        <AnimatePresence>
          {showArrival && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute inset-x-0 bottom-10 flex justify-center z-40 px-4"
            >
              <div className="bg-green-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 border border-white/20">
                <FaCheckCircle className="text-xl" />
                <span className="font-bold tracking-wide">Arrived at Destination</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Indicator Overlay */}
        <div className="absolute top-5 left-5 flex items-center space-x-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Tracking</span>
        </div>

        {/* Decorative Floating Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/10 rounded-full"
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                opacity: 0 
              }}
              animate={{ 
                y: [null, "-20%"],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: Math.random() * 5 + 5, 
                repeat: Infinity, 
                delay: Math.random() * 5 
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
