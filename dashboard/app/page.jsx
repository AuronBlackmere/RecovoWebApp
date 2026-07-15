'use client';
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { auth, db } from "./lib/firebase";
import { 
  GoogleAuthProvider, 
  EmailAuthProvider,
  signInWithCredential, 
  signInWithPopup,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
  verifyBeforeUpdateEmail,
  deleteUser as fbDeleteUser
} from "firebase/auth";
import { ref, get, set, update, onValue, push, remove } from "firebase/database";

/* ═══════════════════════════════════════════════════════════
   SECURITY HELPERS
═══════════════════════════════════════════════════════════ */
const MAX_NAME_LEN = 100;
const MAX_NOTES_LEN = 2000;
const MAX_FEEDBACK_LEN = 5000;
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim();
};
const clampStr = (str, max) => sanitize(str).slice(0, max);

/* ═══════════════════════════════════════════════════════════
   SVG ICON SYSTEM — inline Lucide-style icons, no emoji
═══════════════════════════════════════════════════════════ */
const ICONS = {
  // Nav
  dashboard:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  tracks:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>,
  recovery:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M22 2 12 12"/></svg>,
  injuries:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6"/><path d="M12 9v6"/><circle cx="12" cy="12" r="10"/></svg>,
  daily:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  legion:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  devices:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  readiness:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  athletes:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-1.5-3.1"/><path d="M16 3.13a4 4 0 0 1 0 7.74"/></svg>,
  profile:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  settings:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  // Devices
  watch:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 8h12"/><path d="M6 16h12"/></svg>,
  heartPulse:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 6 1.5-3.5 1 2h4.78"/></svg>,
  activity:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  // Actions & status
  sync:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  check:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  copy:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  camera:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
  search:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  lock:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  upload:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  logout:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  trash:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  edit:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  mail:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  key:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>,
  bell:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  shield:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  help:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
  barChart:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>,
  zap:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>,
  target:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  dumbbell:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1 2.828-2.829l6.365 6.364a2 2 0 1 1-2.829 2.829l-1.767-1.768a2 2 0 1 1-2.829 2.829z"/></svg>,
  heart:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>,
  info:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  plus:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  arrowRight:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  play:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>,
  pause:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>,
  stop:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  moon:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  battery:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>,
  users:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  more:         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  map:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>,
};

// Helper: render icon with optional size override
function Icon({ name, size = 16, color = "currentColor", style = {} }) {
  const base = ICONS[name];
  if (!base) return null;
  const el = React.cloneElement(base, {
    width: size, height: size,
    style: { color, flexShrink: 0, ...style },
    "aria-hidden": true,
  });
  return el;
}

// Status dot component
function StatusDot({ status, size = 7 }) {
  const colors = { active: "#22C55E", connected: "#22C55E", error: "#EF4444", disconnected: "#EF4444", pending: "#F59E0B", syncing: "#F59E0B", offline: "#D4D4D4", default: "#D4D4D4" };
  const color = colors[status] || colors.default;
  const pulse = ["active","connected","syncing"].includes(status);
  return (
    <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, animation: pulse ? "pulse 2s infinite" : "none" }} />
  );
}



const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  /* Light theme tokens */
  --bg:#FFFFFF;--bg2:#F7F7F8;--bg3:#EFEFEF;--bg4:#E5E5E5;
  --surface:#FFFFFF;--border:#E4E4E7;--border2:#C4C4C8;
  --text1:#09090B;--text2:#52525B;--text3:#A1A1AA;
  --accent:#F97316;--accent2:#EA6C0A;--accent-fg:#FFFFFF;
  --red:#EF4444;--red-bg:#FEF2F2;--red-border:#FECACA;
  --green:#22C55E;--green-bg:#F0FDF4;--green-border:#BBF7D0;
  --amber:#F59E0B;--amber-bg:#FFFBEB;--amber-border:#FDE68A;
  --blue:#3B82F6;
  --land-bg:#0A0A0A;--land-surface:#111113;--land-border:rgba(255,255,255,0.07);
  --radius-sm:8px;--radius:12px;--radius-lg:16px;--radius-xl:20px;
  --shadow-sm:0 1px 3px rgba(0,0,0,0.06);
  --shadow:0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:0 8px 28px rgba(0,0,0,0.12);
  --transition:0.15s ease;
}
[data-theme="dark"]{
  --bg:#0A0A0B;--bg2:#111113;--bg3:#1C1C1F;--bg4:#27272A;
  --surface:#18181B;--border:#27272A;--border2:#3F3F46;
  --text1:#FAFAFA;--text2:#A1A1AA;--text3:#52525B;
  --accent:#F97316;--accent2:#EA6C0A;--accent-fg:#FFFFFF;
  --red:#F87171;--red-bg:rgba(239,68,68,0.12);--red-border:rgba(239,68,68,0.25);
  --green:#4ADE80;--green-bg:rgba(34,197,94,0.12);--green-border:rgba(34,197,94,0.25);
  --amber:#FCD34D;--amber-bg:rgba(245,158,11,0.12);--amber-border:rgba(245,158,11,0.25);
  --land-bg:#0A0A0A;--land-surface:#111113;--land-border:rgba(255,255,255,0.07);
  --shadow-sm:0 1px 3px rgba(0,0,0,0.3);
  --shadow:0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:0 8px 28px rgba(0,0,0,0.5);
}
html,body{font-family:'Outfit',sans-serif;background:var(--bg2);color:var(--text1);min-height:100vh}
button{font-family:'Outfit',sans-serif;cursor:pointer}
input,textarea,select{font-family:'Outfit',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.app-shell{display:flex;min-height:100vh;align-items:flex-start}
.sidebar{width:68px;background:var(--bg);border-right:1px solid var(--border);display:flex;flex-direction:column;align-items:center;padding:18px 0;gap:2px;position:fixed;top:0;left:0;bottom:0;z-index:200;transition:width 0.28s cubic-bezier(0.4,0,0.2,1);overflow:hidden}
.sidebar:hover{width:212px}
.sidebar:hover .nav-lbl{opacity:1;max-width:140px}
.sidebar:hover .nav-item{justify-content:flex-start;padding:0 18px;gap:11px}
.sidebar:hover .nav-section{padding:0 18px;opacity:1}
.nav-logo{width:38px;height:38px;background:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:20px;color:#0A0A0B;margin-bottom:18px;flex-shrink:0;box-shadow:var(--shadow)}
.nav-section{font-family:'IBM Plex Mono';font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);padding:0 14px;margin:10px 0 4px;opacity:0;transition:opacity 0.2s;white-space:nowrap;width:100%}
.nav-item{width:calc(100% - 12px);height:42px;display:flex;align-items:center;justify-content:center;border-radius:10px;cursor:pointer;transition:all 0.15s;flex-shrink:0}
.nav-item:hover{background:var(--bg3)}
.nav-item.active{background:var(--text1)}
.nav-item.active .nav-ico{color:var(--accent)}
.nav-item.active .nav-lbl{color:var(--bg)}
.nav-ico{font-size:17px;color:var(--text2);flex-shrink:0;width:18px;text-align:center;transition:color 0.15s}
.nav-lbl{font-size:13px;font-weight:500;color:var(--text2);opacity:0;max-width:0;overflow:hidden;white-space:nowrap;transition:opacity 0.2s,max-width 0.2s}
.main-content{margin-left:68px;flex:1;padding:32px 36px;min-height:100vh;background:var(--bg2)}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.topbar h1{font-family:'Bebas Neue';font-size:28px;letter-spacing:2px;color:var(--text1)}
.topbar-meta{font-size:12px;color:var(--text2);font-family:'IBM Plex Mono';margin-top:3px}
.topbar-right{display:flex;gap:10px;align-items:center}
.avatar{width:36px;height:36px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--accent);cursor:pointer;border:2px solid var(--border)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:22px 24px;transition:box-shadow 0.2s,transform 0.2s;position:relative;overflow:hidden}
.card:hover{box-shadow:0 6px 24px rgba(0,0,0,0.06);transform:translateY(-1px)}
.card.flat:hover{box-shadow:none;transform:none}
.card-lbl{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text2);margin-bottom:8px}
.card-val{font-family:'Bebas Neue';font-size:36px;letter-spacing:1px;color:var(--text1)}
.card-sub{font-size:12px;color:var(--text2);margin-top:4px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.g23{display:grid;grid-template-columns:2fr 3fr;gap:16px;margin-bottom:16px}
.g32{display:grid;grid-template-columns:3fr 2fr;gap:16px;margin-bottom:16px}
.btn{padding:10px 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Outfit';font-size:13px;font-weight:600;transition:all 0.15s;display:inline-flex;align-items:center;gap:8px;line-height:1}
.btn-primary{background:#111111;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.btn-primary:hover{background:#000;box-shadow:0 4px 16px rgba(0,0,0,0.22);transform:translateY(-1px)}
.btn-primary:disabled{background:#999;box-shadow:none;transform:none;cursor:not-allowed}
.btn-yellow{background:var(--accent);color:#111;font-weight:700}
.btn-yellow:hover{background:var(--accent2);transform:translateY(-1px)}
.btn-ghost{background:var(--surface);border:1px solid var(--border);color:var(--text1)}
.btn-ghost:hover{border-color:var(--border2);background:var(--bg3)}
.btn-danger{background:var(--red-bg);color:var(--red);border:1px solid var(--red-border)}
.btn-danger:hover{filter:brightness(0.95)}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:8px}
.btn-lg{padding:14px 28px;font-size:15px;border-radius:12px}
.btn-full{width:100%;justify-content:center}
.input-wrap{margin-bottom:16px}
.input-lbl{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--text2);margin-bottom:6px;display:block}
.input-field{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:11px 14px;color:var(--text1);font-size:14px;outline:none;transition:border-color var(--transition),box-shadow var(--transition)}
.input-field:focus{border-color:#999;box-shadow:0 0 0 3px rgba(0,0,0,0.05)}
.input-field::placeholder{color:var(--text3)}
.input-field:disabled{background:var(--bg3);color:var(--text2);cursor:not-allowed}
.sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.sec-title{font-family:'Bebas Neue';font-size:17px;letter-spacing:2px;color:var(--text1)}
.sec-action{font-size:12px;color:var(--text2);cursor:pointer;font-family:'IBM Plex Mono';transition:color 0.15s}
.sec-action:hover{color:var(--text1)}
.divider{height:1px;background:var(--border);margin:20px 0}
.chip{padding:3px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700;border:1px solid;display:inline-block}
.chip-green{background:var(--green-bg);color:var(--green);border-color:var(--green-border)}
.chip-yellow{background:var(--amber-bg);color:var(--amber);border-color:var(--amber-border)}
.chip-amber{background:var(--amber-bg);color:var(--amber);border-color:var(--amber-border)}
.chip-orange{background:var(--amber-bg);color:var(--accent);border-color:var(--amber-border)}
.chip-red{background:var(--red-bg);color:var(--red);border-color:var(--red-border)}
.chip-gray{background:var(--bg3);color:var(--text2);border-color:var(--border)}
.chip-black{background:#111;color:#fff;border-color:#111}
.tier-elite{color:var(--green);background:var(--green-bg);border:1px solid var(--green-border);padding:2px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
.tier-ready{color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-border);padding:2px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
.tier-mod{color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-border);padding:2px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
.tier-low{color:var(--accent);background:var(--amber-bg);border:1px solid var(--amber-border);padding:2px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
.tier-critical{color:var(--red);background:var(--red-bg);border:1px solid var(--red-border);padding:2px 9px;border-radius:20px;font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
.alert-banner{border-radius:14px;padding:14px 18px;display:flex;align-items:flex-start;gap:14px;margin-bottom:24px;animation:fadeSlide 0.4s ease}
.alert-red{background:var(--red-bg);border:1px solid var(--red-border)}
.alert-orange{background:var(--amber-bg);border:1px solid var(--amber-border)}
.alert-green{background:var(--green-bg);border:1px solid var(--green-border)}
.alert-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0;animation:pulse 1.5s infinite}
.alert-red .alert-dot{background:var(--red)}
.alert-orange .alert-dot{background:var(--orange)}
.alert-green .alert-dot{background:var(--success)}
.alert-title{font-family:'Bebas Neue';font-size:15px;letter-spacing:1px}
.alert-red .alert-title{color:var(--red)}
.alert-orange .alert-title{color:var(--orange)}
.alert-green .alert-title{color:#16A34A}
.alert-desc{font-size:12px;color:var(--text2);margin-top:2px;font-family:'IBM Plex Mono'}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px;text-align:center;min-height:180px}
.empty-icon{font-size:40px;margin-bottom:14px;opacity:0.45}
.empty-title{font-family:'Bebas Neue';font-size:19px;letter-spacing:2px;color:var(--text2);margin-bottom:8px}
.empty-desc{font-size:13px;color:var(--text3);max-width:280px;line-height:1.6}
.ring-wrap{position:relative;display:inline-block}
.ring-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none}
.ring-score{font-family:'Bebas Neue';line-height:1}
.ring-lbl{font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:1px;color:var(--text2)}
.tabs{display:flex;gap:4px;background:var(--bg3);border-radius:12px;padding:4px;border:1px solid var(--border);margin-bottom:20px}
.tab{flex:1;padding:8px 0;text-align:center;border-radius:8px;cursor:pointer;font-family:'IBM Plex Mono';font-size:11px;color:var(--text2);transition:all 0.15s;font-weight:600}
.tab.active{background:#111;color:#fff}
.data-table{width:100%;border-collapse:collapse}
.data-table th{font-family:'IBM Plex Mono';font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text2);padding:9px 12px;text-align:left;border-bottom:1px solid var(--border);background:var(--bg2);white-space:nowrap}
.data-table td{padding:12px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text1)}
.data-table tr:hover td{background:var(--bg2)}
.data-table tr:last-child td{border-bottom:none}
.workout-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
.workout-row:last-child{border-bottom:none}
.workout-ico{width:38px;height:38px;border-radius:12px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.workout-name{font-size:14px;font-weight:600;color:var(--text1)}
.workout-meta{font-family:'IBM Plex Mono';font-size:11px;color:var(--text2);margin-top:2px}
.workout-cal{margin-left:auto;font-family:'IBM Plex Mono';font-size:12px;font-weight:700;background:var(--accent);color:#111;padding:3px 9px;border-radius:20px;white-space:nowrap}
.ex-input{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:5px 8px;color:var(--text1);width:64px;text-align:center;font-family:'IBM Plex Mono';font-size:13px}
.ex-input:focus{outline:none;border-color:#999;box-shadow:0 0 0 3px rgba(0,0,0,0.05)}
.device-row{display:flex;align-items:center;gap:14px;padding:13px 16px;background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:8px;transition:box-shadow 0.15s}
.device-row:hover{box-shadow:0 4px 14px rgba(0,0,0,0.06)}
.device-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg3);border:1px solid var(--border)}
.sync-dot{width:7px;height:7px;border-radius:50%;margin-left:auto;animation:pulse 2s infinite}
.sync-dot.on{background:var(--success)}
.sync-dot.off{background:var(--border2);animation:none}
.ai-card{background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:20px;padding:22px}
.ai-msg{font-size:14px;line-height:1.65;color:var(--text1)}
.status-slider{width:100%;margin:10px 0 4px;-webkit-appearance:none;height:5px;border-radius:3px;outline:none;cursor:pointer}
.status-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#111;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.2)}
.panel-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.22);z-index:500;display:flex;justify-content:flex-end;backdrop-filter:blur(3px)}
.panel{width:480px;height:100vh;background:var(--surface);border-left:1px solid var(--border);padding:28px;overflow-y:auto;animation:slideIn 0.28s cubic-bezier(0.4,0,0.2,1);box-shadow:-8px 0 32px rgba(0,0,0,0.08)}
.panel-close{cursor:pointer;font-size:18px;color:var(--text2);float:right;transition:color 0.15s}
.panel-close:hover{color:var(--text1)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:600;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fadeIn 0.2s ease}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:32px;max-width:400px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.12);animation:scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)}
.modal-title{font-family:'Bebas Neue';font-size:22px;letter-spacing:1px;margin-bottom:8px}
.modal-desc{font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:24px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end}
.sparkline{display:flex;align-items:flex-end;gap:3px;height:32px}
.spark-bar{flex:1;border-radius:2px 2px 0 0;min-width:5px}
.timer-display{font-family:'Bebas Neue';font-size:60px;letter-spacing:4px;text-align:center;color:var(--text1)}
.injury-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:10px;cursor:pointer;transition:all 0.2s}
.injury-card:hover{box-shadow:0 6px 20px rgba(0,0,0,0.07);border-color:var(--border2);transform:translateY(-1px)}
.code-card{background:var(--surface);border:2px solid var(--accent);border-radius:20px;text-align:center;padding:32px}
.code-display{font-family:'Bebas Neue';font-size:52px;letter-spacing:10px;color:var(--text1);text-align:center;padding:16px}
.profile-pic-wrap{position:relative;display:inline-block;cursor:pointer}
.profile-pic-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;color:#fff;font-size:18px}
.profile-pic-wrap:hover .profile-pic-overlay{opacity:1}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block}
.spinner-dark{border:2px solid var(--border);border-top-color:var(--text1)}
.skeleton{background:linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:8px}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.land{background:#050505;color:#fff;min-height:100vh;font-family:'Outfit',sans-serif;overflow-x:hidden}
.land-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:18px 60px;background:rgba(5,5,5,0.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.07)}
.land-logo{display:flex;align-items:center;gap:10px}
.land-logo-mark{width:36px;height:36px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:18px;color:#111}
.land-logo-text{font-family:'Bebas Neue';font-size:22px;letter-spacing:2px;color:#fff}
.land-nav-links{display:flex;gap:28px;align-items:center}
.land-nav-link{font-size:14px;color:rgba(255,255,255,0.6);cursor:pointer;transition:color 0.15s;background:none;border:none;font-family:'Outfit'}
.land-nav-link:hover{color:#fff}
.land-nav-btns{display:flex;gap:10px}
.land-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 60px 80px;position:relative;overflow:hidden}
.land-glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(255,214,0,0.07) 0%,transparent 70%);pointer-events:none}
.land-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(255,214,0,0.1);border:1px solid rgba(255,214,0,0.25);border-radius:20px;padding:5px 14px;font-family:'IBM Plex Mono';font-size:11px;color:var(--accent);letter-spacing:1px;text-transform:uppercase;margin-bottom:24px}
.land-h1{font-family:'Bebas Neue';font-size:clamp(54px,8vw,94px);letter-spacing:2px;line-height:0.95;margin-bottom:24px}
.land-h1 span{color:var(--accent)}
.land-sub{font-size:17px;color:rgba(255,255,255,0.55);max-width:540px;line-height:1.7;margin-bottom:40px}
.land-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:64px}
.land-btn-p{background:var(--accent);color:#111;font-family:'Outfit';font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px;border:none;cursor:pointer;transition:all 0.2s}
.land-btn-p:hover{background:var(--accent2);transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,214,0,0.28)}
.land-btn-g{background:transparent;color:#fff;font-family:'Outfit';font-size:15px;padding:13px 28px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;transition:all 0.2s}
.land-btn-g:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.35)}
.land-mockup{width:100%;max-width:860px;margin:0 auto;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:24px;padding:24px;box-shadow:0 40px 100px rgba(0,0,0,0.5)}
.land-mockup-bar{display:flex;gap:6px;margin-bottom:18px}
.land-mockup-dot{width:10px;height:10px;border-radius:50%}
.land-section{padding:96px 60px;max-width:1180px;margin:0 auto}
.land-section-eyebrow{font-family:'IBM Plex Mono';font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-bottom:12px}
.land-section-h{font-family:'Bebas Neue';font-size:clamp(34px,4vw,50px);letter-spacing:2px;color:#fff;margin-bottom:14px}
.land-section-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;line-height:1.7;margin-bottom:44px}
.land-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.land-feat-card{background:#0D0D0D;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:26px;transition:all 0.2s}
.land-feat-card:hover{border-color:rgba(255,214,0,0.18);box-shadow:0 8px 32px rgba(0,0,0,0.4)}
.land-feat-ico{width:44px;height:44px;background:rgba(255,214,0,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;border:1px solid rgba(255,214,0,0.15)}
.land-feat-title{font-family:'Bebas Neue';font-size:17px;letter-spacing:1px;color:#fff;margin-bottom:7px}
.land-feat-desc{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.6}
.land-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.land-step{text-align:center;padding:26px 18px}
.land-step-n{font-family:'Bebas Neue';font-size:48px;color:rgba(255,214,0,0.15);line-height:1;margin-bottom:10px}
.land-step-title{font-family:'Bebas Neue';font-size:17px;letter-spacing:1px;color:#fff;margin-bottom:7px}
.land-step-desc{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.6}
.land-alert-section{background:#0D0D0D;border:1px solid rgba(255,255,255,0.07);border-radius:26px;padding:48px;margin:0 60px}
.land-footer{background:#0A0A0A;border-top:1px solid rgba(255,255,255,0.07);padding:48px 60px 32px}
.land-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.land-footer-link{display:block;font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:10px;cursor:pointer;transition:color 0.15s;background:none;border:none;font-family:'Outfit';text-align:left;padding:0}
.land-footer-link:hover{color:#fff}
.land-footer-bottom{border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;display:flex;justify-content:space-between;align-items:center}
.auth-page{min-height:100vh;background:var(--bg2);display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{width:100%;max-width:420px;background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:40px;box-shadow:0 16px 48px rgba(0,0,0,0.07)}
.auth-logo{display:flex;align-items:center;gap:10px;margin-bottom:32px}
.auth-logo-mark{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:18px;color:#111}
.auth-logo-text{font-family:'Bebas Neue';font-size:20px;letter-spacing:2px;color:var(--text1)}
.auth-title{font-family:'Bebas Neue';font-size:28px;letter-spacing:2px;color:var(--text1);margin-bottom:6px}
.auth-sub{font-size:14px;color:var(--text2);margin-bottom:28px}
.auth-divider{display:flex;align-items:center;gap:12px;margin:20px 0}
.auth-divider-line{flex:1;height:1px;background:var(--border)}
.auth-divider-text{font-size:12px;color:var(--text3);font-family:'IBM Plex Mono'}
.auth-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:14px;font-weight:500;color:var(--text1);cursor:pointer;transition:all 0.15s;font-family:'Outfit'}
.auth-google:hover{background:var(--bg3);border-color:var(--border2)}
.auth-error{background:var(--red-bg);border:1px solid var(--red-border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--red);margin-bottom:16px}
.auth-switch{text-align:center;font-size:13px;color:var(--text2);margin-top:20px}
.auth-switch a{color:var(--text1);font-weight:600;cursor:pointer;border-bottom:1px solid var(--border2)}
.onboard-page{min-height:100vh;background:var(--bg2);display:flex;align-items:center;justify-content:center;padding:24px}
.onboard-card{width:100%;max-width:480px;background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:40px;box-shadow:0 16px 48px rgba(0,0,0,0.07)}
.onboard-step-bar{display:flex;gap:6px;margin-bottom:28px}
.onboard-step-dot{height:3px;border-radius:2px;flex:1;transition:background 0.3s}
.sport-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:236px;overflow-y:auto}
.sport-btn{padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;text-align:center;font-size:12px;font-weight:500;transition:all 0.15s;color:var(--text1);font-family:'Outfit'}
.sport-btn:hover{border-color:var(--border2);background:var(--surface)}
.sport-btn.sel{border-color:#111;background:var(--accent);color:#111;font-weight:700;box-shadow:0 0 0 1px #111}
.role-btn{width:100%;padding:17px;border-radius:14px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;text-align:left;margin-bottom:10px;transition:all 0.15s;color:var(--text1);font-family:'Outfit'}
.role-btn:hover{border-color:var(--border2);background:var(--surface)}
.role-btn.sel{border-color:#111;background:var(--surface);box-shadow:0 0 0 2px #111}
.role-btn-title{font-size:15px;font-weight:600}
.role-btn-desc{font-size:12px;color:var(--text2);margin-top:4px}

/* ── BOTTOM TAB BAR (mobile nav) ── */
.bottom-nav{
  display:none;
  position:fixed;bottom:0;left:0;right:0;z-index:300;
  background:var(--surface);border-top:1px solid var(--border);
  padding:6px 0 max(8px,env(safe-area-inset-bottom));
  box-shadow:0 -4px 20px rgba(0,0,0,0.07);
}
.bottom-nav-inner{display:flex;align-items:stretch;justify-content:space-around}
.bnav-item{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;padding:6px 2px;cursor:pointer;border-radius:10px;transition:all 0.15s;
  -webkit-tap-highlight-color:transparent;min-height:52px;
}
.bnav-item:active{background:var(--bg3);transform:scale(0.93)}
.bnav-ico{font-size:20px;line-height:1;transition:transform 0.15s}
.bnav-lbl{font-family:'IBM Plex Mono';font-size:9px;color:var(--text3);letter-spacing:0.5px;text-transform:uppercase;transition:color 0.15s;white-space:nowrap}
.bnav-item.active .bnav-ico{transform:scale(1.12)}
.bnav-item.active .bnav-lbl{color:#111;font-weight:700}
.bnav-dot{width:4px;height:4px;border-radius:50%;background:var(--accent);margin-top:2px;opacity:0;transition:opacity 0.15s}
.bnav-item.active .bnav-dot{opacity:1}

/* ── MOBILE HEADER ── */
.mobile-header{
  display:none;position:fixed;top:0;left:0;right:0;z-index:250;
  background:var(--surface);border-bottom:1px solid var(--border);
  padding:max(12px,env(safe-area-inset-top)) 16px 12px;
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  flex-direction:row;align-items:center;justify-content:space-between;
}
.mobile-header-logo{display:flex;align-items:center;gap:8px}
.mobile-header-logo-mark{width:30px;height:30px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:15px;color:#111}
.mobile-header-title{font-family:'Bebas Neue';font-size:18px;letter-spacing:2px;color:var(--text1)}
.mobile-header-right{display:flex;gap:10px;align-items:center}
.mobile-avatar{width:32px;height:32px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:13px;color:var(--accent);border:2px solid var(--border);cursor:pointer;-webkit-tap-highlight-color:transparent;overflow:hidden}
.mobile-avatar img{width:100%;height:100%;object-fit:cover}

/* ── PWA SAFE AREAS ── */
.pwa-safe-top{padding-top:max(0px,env(safe-area-inset-top))}
.pwa-safe-bottom{padding-bottom:max(0px,env(safe-area-inset-bottom))}
html{height:100%;overflow-x:hidden}
body{min-height:100%;overflow-x:hidden}
#root{min-height:100%}

/* ── PULL TO REFRESH INDICATOR ── */
.ptr-indicator{
  position:fixed;top:60px;left:50%;transform:translateX(-50%);
  background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:8px 16px;display:flex;align-items:center;gap:8px;
  font-family:'IBM Plex Mono';font-size:11px;color:var(--text2);
  box-shadow:0 4px 16px rgba(0,0,0,0.1);z-index:400;
  animation:fadeSlide 0.2s ease;
}

/* ═══════════════════════════════════
   RESPONSIVE BREAKPOINTS
═══════════════════════════════════ */

/* ── TABLET 768–1024px ── */
@media(max-width:1024px){
  .main-content{padding:24px 20px}
  .g4{grid-template-columns:1fr 1fr}
  .g3{grid-template-columns:1fr 1fr}
  .land-feat-grid{grid-template-columns:1fr 1fr}
  .land-steps{grid-template-columns:1fr 1fr}
  .land-footer-grid{grid-template-columns:1fr 1fr;gap:28px}
  .land-nav{padding:14px 28px}
  .land-section{padding:64px 32px}
  .land-alert-section{margin:0 32px}
  .land-footer{padding:36px 32px 24px}
}

/* ── MOBILE ≤768px — core layout switch ── */
@media(max-width:768px){
  /* Hide desktop sidebar */
  .sidebar{display:none !important}
  /* Show mobile chrome */
  .bottom-nav{display:block}
  .mobile-header{display:flex}

  /* Main content: full width, pad for header+bottom nav */
  .main-content{
    margin-left:0 !important;
    padding:76px 16px 90px !important;
    min-height:100vh;
  }

  /* Topbar inside pages - simplify on mobile */
  .topbar{margin-bottom:18px}
  .topbar h1{font-size:22px;letter-spacing:1.5px}
  .topbar-meta{font-size:10px}
  .topbar-right{gap:6px}

  /* All multi-col grids collapse to single col */
  .g2,.g3,.g4,.g23,.g32{grid-template-columns:1fr !important;gap:12px}

  /* Cards tighter */
  .card{padding:16px;border-radius:16px}
  .card-val{font-size:28px}

  /* Landing page */
  .land-nav{padding:14px 18px}
  .land-nav-links{display:none}
  .land-nav-btns{gap:8px}
  .land-btn-p,.land-btn-g{font-size:13px;padding:10px 16px;border-radius:10px}
  .land-hero{padding:90px 20px 60px;min-height:100svh}
  .land-h1{font-size:clamp(44px,12vw,70px);letter-spacing:1px}
  .land-sub{font-size:15px;max-width:100%}
  .land-btns{flex-direction:column;gap:10px;align-items:center;margin-bottom:40px}
  .land-btns button,.land-btns .land-btn-p,.land-btns .land-btn-g{width:100%;max-width:280px;justify-content:center}
  .land-mockup{padding:16px;border-radius:16px}
  .land-mockup>div:first-child+div{grid-template-columns:1fr 1fr !important}
  .land-section{padding:56px 20px 32px}
  .land-section-h{font-size:clamp(28px,7vw,40px)}
  .land-feat-grid{grid-template-columns:1fr}
  .land-steps{grid-template-columns:1fr 1fr}
  .land-alert-section{margin:0 20px;padding:28px 20px}
  .land-footer{padding:36px 20px 24px}
  .land-footer-grid{grid-template-columns:1fr 1fr;gap:24px}
  .land-footer-bottom{flex-direction:column;gap:12px;text-align:center}

  /* Auth cards */
  .auth-card{padding:28px 20px;border-radius:20px}
  .onboard-card{padding:28px 20px;border-radius:20px}

  /* Tabs */
  .tabs{gap:2px}
  .tab{font-size:10px;padding:7px 0}

  /* Panel (slide-in detail) - full width on mobile */
  .panel{width:100vw;border-left:none;border-top:1px solid var(--border);border-radius:20px 20px 0 0;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1)}
  .panel-overlay{align-items:flex-end}

  /* Data table - horizontal scroll */
  .data-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -16px;padding:0 16px}
  .data-table{min-width:500px}

  /* Timer */
  .timer-display{font-size:44px;letter-spacing:2px}

  /* Toasts */
  .toast-container{bottom:84px !important;right:12px !important;left:12px !important;max-width:none !important}

  /* Modal */
  .modal{border-radius:20px;padding:24px}

  /* Code display */
  .code-display{font-size:38px;letter-spacing:6px}

  /* Workout rows */
  .workout-row{gap:10px}

  /* Status sliders */
  .status-slider{height:6px}
  .status-slider::-webkit-slider-thumb{width:22px;height:22px}

  /* Ex inputs on tracks */
  .ex-input{width:52px}

  /* Profile pic wrap */
  .profile-pic-wrap:hover .profile-pic-overlay{opacity:0}
  .profile-pic-wrap:active .profile-pic-overlay{opacity:1}
}

/* ── SMALL PHONES ≤380px ── */
@media(max-width:380px){
  .main-content{padding:72px 12px 86px !important}
  .land-h1{font-size:42px}
  .card{padding:14px}
  .land-steps{grid-template-columns:1fr}
  .land-footer-grid{grid-template-columns:1fr}
  .auth-card{padding:22px 16px}
  .onboard-card{padding:22px 16px}
  .sport-grid{grid-template-columns:repeat(2,1fr)}
}

/* ── MOBILE ≤768px — mobile-first redesign ── */
@media(max-width:768px){
  .sidebar{display:none !important}
  .bottom-nav{display:block}
  .mobile-header{display:flex}

  .main-content{
    margin-left:0 !important;
    padding:72px 18px 96px !important;
    min-height:100vh;
  }

  /* Typography */
  .topbar{margin-bottom:20px}
  .topbar h1{font-size:24px;letter-spacing:1.5px}
  .topbar-meta{font-size:11px;margin-top:2px}

  /* All grids → single column with generous gap */
  .g2,.g3,.g4,.g23,.g32{
    grid-template-columns:1fr !important;
    gap:12px;
  }

  /* Cards — more breathing room */
  .card{padding:18px;border-radius:18px}
  .card-val{font-size:30px}
  .card-lbl{font-size:9px}
  .card-sub{font-size:12px}

  /* Topbar right — smaller gap */
  .topbar-right{gap:8px}
  .topbar-right .btn{font-size:12px;padding:8px 12px}

  /* Inputs — larger tap targets */
  .input-field{padding:13px 14px;font-size:15px;border-radius:12px}
  .input-lbl{font-size:9px;margin-bottom:7px}
  .input-wrap{margin-bottom:18px}

  /* Buttons — full width on mobile forms */
  .btn-lg{padding:15px 24px;font-size:15px}
  .btn{min-height:42px}

  /* Tabs */
  .tabs{gap:3px;border-radius:12px;padding:3px}
  .tab{font-size:10px;padding:8px 0;min-height:36px}

  /* Section headers */
  .sec-title{font-size:15px}

  /* Workout rows */
  .workout-row{gap:12px;padding:14px 0}
  .workout-ico{width:42px;height:42px}

  /* Panel (coach detail) — full-screen bottom sheet */
  .panel{
    width:100vw;max-height:92vh;
    border-left:none;border-radius:20px 20px 0 0;
    padding:24px 18px;
  }
  .panel-overlay{align-items:flex-end}

  /* Data table — horizontal scroll */
  .data-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -18px;padding:0 18px}
  .data-table{min-width:520px}

  /* Timer */
  .timer-display{font-size:48px;letter-spacing:3px}

  /* Modal */
  .modal{border-radius:20px;padding:24px 20px;max-width:100%;margin:0 16px}
  .modal-overlay{padding:0 0 0 0;align-items:flex-end}

  /* Code display */
  .code-display{font-size:40px;letter-spacing:6px}

  /* Status sliders — bigger thumb */
  .status-slider{height:6px;border-radius:4px}
  .status-slider::-webkit-slider-thumb{width:24px;height:24px}

  /* Exercise inputs */
  .ex-input{width:56px;padding:6px 4px}

  /* Auth */
  .auth-card{padding:28px 20px;border-radius:20px;margin:0}
  .auth-page{padding:18px;align-items:flex-start;padding-top:48px}
  .onboard-card{padding:28px 20px;border-radius:20px}
  .onboard-page{padding:18px;align-items:flex-start;padding-top:48px}

  /* Profile pic overlay — always visible on mobile */
  .profile-pic-overlay{opacity:0.85 !important}

  /* Bottom nav */
  .bottom-nav-inner{padding:0 4px}
  .bnav-item{min-height:54px;padding:7px 2px}
  .bnav-ico{font-size:22px}
  .bnav-lbl{font-size:9px;letter-spacing:0}

  /* Landing */
  .land-nav{padding:14px 18px}
  .land-nav-links{display:none}
  .land-hero{padding:88px 20px 56px;min-height:100svh}
  .land-h1{font-size:clamp(44px,12vw,70px)}
  .land-sub{font-size:15px;max-width:100%}
  .land-btns{flex-direction:column;gap:10px;align-items:center;margin-bottom:36px}
  .land-btns>*{width:100%;max-width:300px;justify-content:center}
  .land-mockup{padding:16px;border-radius:16px}
  .land-section{padding:56px 20px 28px}
  .land-section-h{font-size:clamp(28px,7vw,40px)}
  .land-feat-grid{grid-template-columns:1fr}
  .land-steps{grid-template-columns:1fr 1fr}
  .land-alert-section{margin:0 18px;padding:28px 20px}
  .land-footer{padding:36px 18px 24px}
  .land-footer-grid{grid-template-columns:1fr 1fr;gap:20px}
  .land-footer-bottom{flex-direction:column;gap:10px;text-align:center}

  /* Toast — above bottom nav */
  .toast-container{bottom:88px !important;right:14px !important;left:14px !important;max-width:none !important}
}

/* ── SMALL PHONES ≤390px ── */
@media(max-width:390px){
  .main-content{padding:68px 14px 90px !important}
  .land-h1{font-size:42px}
  .card{padding:15px}
  .land-steps{grid-template-columns:1fr}
  .land-footer-grid{grid-template-columns:1fr}
  .auth-card,.onboard-card{padding:24px 16px}
  .sport-grid{grid-template-columns:repeat(2,1fr)}
  .code-display{font-size:34px;letter-spacing:4px}
  .timer-display{font-size:40px}
}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}

`;


/* ═══════════════════════════════════════════════════════════
   I18N — LANGUAGE SYSTEM
═══════════════════════════════════════════════════════════ */

const TRANSLATIONS = {
  en: {
    // Nav
    dashboard:"Dashboard", tracks:"Tracks", recovery:"Recovery",
    injuries:"Injuries", daily:"Daily Status", legion:"Legion",
    devices:"Devices", profile:"Profile", settings:"Settings",
    athletes:"Athletes", readiness:"Readiness",
    // Common
    save:"Save Changes", cancel:"Cancel", edit:"Edit", delete:"Delete",
    confirm:"Confirm", loading:"Loading…", retry:"Retry",
    connect:"Connect", disconnect:"Disconnect", sync:"Sync",
    close:"Close", back:"Back", next:"Continue", finish:"Finish",
    // Settings sections
    settingsTitle:"Settings", notifications:"Notifications",
    privacy:"Privacy", account:"Account", security:"Security",
    language:"Language", theme:"Theme", units:"Units",
    appearance:"Appearance", connectedDevices:"Connected Devices",
    // Notifications
    dailyReadiness:"Daily Readiness Alert",
    dailyReadinessDesc:"Morning notification when your score is ready.",
    coachAlerts:"Coach Messages",
    coachAlertsDesc:"Alerts from your coach via the Legion dashboard.",
    injuryWarnings:"Injury Risk Warnings",
    injuryWarningsDesc:"Critical alerts from the Kinetic Alert Engine.",
    weeklyReport:"Weekly Summary",
    weeklyReportDesc:"Training and recovery report every Sunday.",
    sessionReminder:"Session Reminder",
    sessionReminderDesc:"Daily prompt to log your status.",
    deviceSync:"Device Sync Alerts",
    deviceSyncDesc:"Notify when a wearable sync completes or fails.",
    // Privacy
    shareReadiness:"Share Readiness Score",
    shareReadinessDesc:"Coach sees your daily readiness ring and score.",
    shareBiometrics:"Share Biometrics",
    shareBiometricsDesc:"HRV, resting heart rate, and sleep data.",
    shareWorkouts:"Share Workout History",
    shareWorkoutsDesc:"Allow your coach to view your logged sessions.",
    analytics:"Analytics & Improvement",
    analyticsDesc:"Help improve Recovo with anonymised usage data.",
    // Security
    twoFactor:"Two-Factor Authentication",
    twoFactorDesc:"Require a code in addition to your password when signing in.",
    loginAlerts:"Login Alerts",
    loginAlertsDesc:"Get notified of new sign-ins to your account.",
    // Theme
    lightMode:"Light Mode", darkMode:"Dark Mode", systemTheme:"System Default",
    // Units
    weight:"Weight", distance:"Distance", temperature:"Temperature",
    // Account
    emailAddress:"Email Address", password:"Password",
    accountType:"Account Type", dataPrivacy:"Data & Privacy",
    dataPrivacyDesc:"Your health data is stored locally and never shared without consent.",
    // Profile
    fullName:"Full Name", age:"Age", height:"Height (cm)",
    bodyWeight:"Weight (kg)", sport:"Sport", team:"Team / Club",
    editProfile:"Edit Profile", changePassword:"Change Password",
    changeEmail:"Change Email", deleteAccount:"Delete Account",
    support:"Support & Feedback",
    // Auth
    signIn:"Sign In", signUp:"Create Account", signOut:"Sign Out",
    email:"Email", name:"Full Name",
    // Empty states
    noData:"No data yet",
    noWorkouts:"No workouts logged yet.",
    noReadiness:"No readiness data.",
    noAthletes:"No athletes yet.",
    // Misc
    version:"Version", build:"Build", platform:"Platform",
    storage:"Storage", clearCache:"Clear Cache", exportData:"Export My Data",
    about:"About",
  },
  fr: {
    dashboard:"Tableau de bord", tracks:"EntraÃ®nements", recovery:"RÃ©cupÃ©ration",
    injuries:"Blessures", daily:"Statut quotidien", legion:"LÃ©gion",
    devices:"Appareils", profile:"Profil", settings:"ParamÃ¨tres",
    athletes:"AthlÃ¨tes", readiness:"DisponibilitÃ©",
    save:"Enregistrer", cancel:"Annuler", edit:"Modifier", delete:"Supprimer",
    confirm:"Confirmer", loading:"Chargement…", retry:"RÃ©essayer",
    connect:"Connecter", disconnect:"DÃ©connecter", sync:"Synchroniser",
    close:"Fermer", back:"Retour", next:"Continuer", finish:"Terminer",
    settingsTitle:"ParamÃ¨tres", notifications:"Notifications",
    privacy:"ConfidentialitÃ©", account:"Compte", security:"SÃ©curitÃ©",
    language:"Langue", theme:"ThÃ¨me", units:"UnitÃ©s",
    appearance:"Apparence", connectedDevices:"Appareils connectÃ©s",
    dailyReadiness:"Alerte de disponibilitÃ© quotidienne",
    dailyReadinessDesc:"Notification matinale quand votre score est prÃªt.",
    coachAlerts:"Messages du coach",
    coachAlertsDesc:"Alertes de votre coach via le tableau de bord LÃ©gion.",
    injuryWarnings:"Alertes de risque de blessure",
    injuryWarningsDesc:"Alertes critiques du moteur Kinetic.",
    weeklyReport:"RÃ©sumÃ© hebdomadaire",
    weeklyReportDesc:"Rapport d'entraÃ®nement et de rÃ©cupÃ©ration chaque dimanche.",
    sessionReminder:"Rappel de sÃ©ance",
    sessionReminderDesc:"Rappel quotidien pour enregistrer votre statut.",
    deviceSync:"Alertes de synchronisation",
    deviceSyncDesc:"Notifier quand une synchronisation se termine ou Ã©choue.",
    shareReadiness:"Partager le score de disponibilitÃ©",
    shareReadinessDesc:"Le coach voit votre anneau et score de disponibilitÃ© quotidien.",
    shareBiometrics:"Partager les donnÃ©es biomÃ©triques",
    shareBiometricsDesc:"VFC, frÃ©quence cardiaque au repos et donnÃ©es de sommeil.",
    shareWorkouts:"Partager l'historique d'entraÃ®nement",
    shareWorkoutsDesc:"Permettre Ã  votre coach de voir vos sÃ©ances enregistrÃ©es.",
    analytics:"Analyses et amÃ©liorations",
    analyticsDesc:"Aider Ã  amÃ©liorer Recovo avec des donnÃ©es anonymisÃ©es.",
    twoFactor:"Authentification Ã  deux facteurs",
    twoFactorDesc:"Exiger un code en plus de votre mot de passe lors de la connexion.",
    loginAlerts:"Alertes de connexion",
    loginAlertsDesc:"ÃŠtre notifiÃ© des nouvelles connexions Ã  votre compte.",
    lightMode:"Mode clair", darkMode:"Mode sombre", systemTheme:"DÃ©faut du systÃ¨me",
    weight:"Poids", distance:"Distance", temperature:"TempÃ©rature",
    emailAddress:"Adresse e-mail", password:"Mot de passe",
    accountType:"Type de compte", dataPrivacy:"DonnÃ©es et confidentialitÃ©",
    dataPrivacyDesc:"Vos donnÃ©es de santÃ© sont stockÃ©es localement et jamais partagÃ©es sans consentement.",
    fullName:"Nom complet", age:"Ã‚ge", height:"Taille (cm)",
    bodyWeight:"Poids (kg)", sport:"Sport", team:"Ã‰quipe / Club",
    editProfile:"Modifier le profil", changePassword:"Changer le mot de passe",
    changeEmail:"Changer l'e-mail", deleteAccount:"Supprimer le compte",
    support:"Assistance et commentaires",
    signIn:"Se connecter", signUp:"CrÃ©er un compte", signOut:"Se dÃ©connecter",
    email:"E-mail", name:"Nom complet",
    noData:"Pas encore de donnÃ©es", noWorkouts:"Aucun entraÃ®nement enregistrÃ©.",
    noReadiness:"Aucune donnÃ©e de disponibilitÃ©.", noAthletes:"Aucun athlÃ¨te.",
    version:"Version", build:"Build", platform:"Plateforme",
    storage:"Stockage", clearCache:"Vider le cache", exportData:"Exporter mes donnÃ©es",
    about:"Ã€ propos",
  },
  es: {
    dashboard:"Panel", tracks:"Entrenamientos", recovery:"RecuperaciÃ³n",
    injuries:"Lesiones", daily:"Estado diario", legion:"LegiÃ³n",
    devices:"Dispositivos", profile:"Perfil", settings:"Ajustes",
    athletes:"Atletas", readiness:"Disponibilidad",
    save:"Guardar cambios", cancel:"Cancelar", edit:"Editar", delete:"Eliminar",
    confirm:"Confirmar", loading:"Cargando…", retry:"Reintentar",
    connect:"Conectar", disconnect:"Desconectar", sync:"Sincronizar",
    close:"Cerrar", back:"AtrÃ¡s", next:"Continuar", finish:"Terminar",
    settingsTitle:"Ajustes", notifications:"Notificaciones",
    privacy:"Privacidad", account:"Cuenta", security:"Seguridad",
    language:"Idioma", theme:"Tema", units:"Unidades",
    appearance:"Apariencia", connectedDevices:"Dispositivos conectados",
    dailyReadiness:"Alerta de disponibilidad diaria",
    dailyReadinessDesc:"NotificaciÃ³n matutina cuando tu puntuaciÃ³n estÃ© lista.",
    coachAlerts:"Mensajes del entrenador",
    coachAlertsDesc:"Alertas de tu entrenador via el panel LegiÃ³n.",
    injuryWarnings:"Advertencias de riesgo de lesiÃ³n",
    injuryWarningsDesc:"Alertas crÃ­ticas del motor Kinetic.",
    weeklyReport:"Resumen semanal",
    weeklyReportDesc:"Informe de entrenamiento y recuperaciÃ³n cada domingo.",
    sessionReminder:"Recordatorio de sesiÃ³n",
    sessionReminderDesc:"Recordatorio diario para registrar tu estado.",
    deviceSync:"Alertas de sincronizaciÃ³n",
    deviceSyncDesc:"Notificar cuando una sincronizaciÃ³n se complete o falle.",
    shareReadiness:"Compartir puntuaciÃ³n de disponibilidad",
    shareReadinessDesc:"El entrenador ve tu anillo y puntuaciÃ³n de disponibilidad diaria.",
    shareBiometrics:"Compartir datos biomÃ©tricos",
    shareBiometricsDesc:"VFC, frecuencia cardÃ­aca en reposo y datos de sueÃ±o.",
    shareWorkouts:"Compartir historial de entrenamientos",
    shareWorkoutsDesc:"Permitir a tu entrenador ver tus sesiones registradas.",
    analytics:"AnÃ¡lisis y mejoras",
    analyticsDesc:"Ayudar a mejorar Recovo con datos anonimizados.",
    twoFactor:"AutenticaciÃ³n de dos factores",
    twoFactorDesc:"Requerir un cÃ³digo ademÃ¡s de tu contraseÃ±a al iniciar sesiÃ³n.",
    loginAlerts:"Alertas de inicio de sesiÃ³n",
    loginAlertsDesc:"Ser notificado de nuevos inicios de sesiÃ³n en tu cuenta.",
    lightMode:"Modo claro", darkMode:"Modo oscuro", systemTheme:"Predeterminado del sistema",
    weight:"Peso", distance:"Distancia", temperature:"Temperatura",
    emailAddress:"DirecciÃ³n de correo", password:"ContraseÃ±a",
    accountType:"Tipo de cuenta", dataPrivacy:"Datos y privacidad",
    dataPrivacyDesc:"Tus datos de salud se almacenan localmente y nunca se comparten sin consentimiento.",
    fullName:"Nombre completo", age:"Edad", height:"Altura (cm)",
    bodyWeight:"Peso (kg)", sport:"Deporte", team:"Equipo / Club",
    editProfile:"Editar perfil", changePassword:"Cambiar contraseÃ±a",
    changeEmail:"Cambiar correo", deleteAccount:"Eliminar cuenta",
    support:"Soporte y comentarios",
    signIn:"Iniciar sesiÃ³n", signUp:"Crear cuenta", signOut:"Cerrar sesiÃ³n",
    email:"Correo", name:"Nombre completo",
    noData:"Sin datos aÃºn", noWorkouts:"Sin entrenamientos registrados.",
    noReadiness:"Sin datos de disponibilidad.", noAthletes:"Sin atletas.",
    version:"VersiÃ³n", build:"Build", platform:"Plataforma",
    storage:"Almacenamiento", clearCache:"Borrar cachÃ©", exportData:"Exportar mis datos",
    about:"Acerca de",
  },
  de: {
    dashboard:"Dashboard", tracks:"Training", recovery:"Erholung",
    injuries:"Verletzungen", daily:"Tagesstatus", legion:"Legion",
    devices:"GerÃ¤te", profile:"Profil", settings:"Einstellungen",
    athletes:"Athleten", readiness:"Bereitschaft",
    save:"Ã„nderungen speichern", cancel:"Abbrechen", edit:"Bearbeiten", delete:"LÃ¶schen",
    confirm:"BestÃ¤tigen", loading:"Laden…", retry:"Erneut versuchen",
    connect:"Verbinden", disconnect:"Trennen", sync:"Synchronisieren",
    close:"SchlieÃŸen", back:"ZurÃ¼ck", next:"Weiter", finish:"AbschlieÃŸen",
    settingsTitle:"Einstellungen", notifications:"Benachrichtigungen",
    privacy:"Datenschutz", account:"Konto", security:"Sicherheit",
    language:"Sprache", theme:"Design", units:"Einheiten",
    appearance:"Erscheinungsbild", connectedDevices:"Verbundene GerÃ¤te",
    dailyReadiness:"TÃ¤gliche Bereitschaftsbenachrichtigung",
    dailyReadinessDesc:"Morgenbenachrichtigung wenn dein Score bereit ist.",
    coachAlerts:"Trainer-Nachrichten",
    coachAlertsDesc:"Benachrichtigungen von deinem Trainer Ã¼ber das Legion-Dashboard.",
    injuryWarnings:"Verletzungsrisiko-Warnungen",
    injuryWarningsDesc:"Kritische Warnungen von der Kinetic-Engine.",
    weeklyReport:"Wochenzusammenfassung",
    weeklyReportDesc:"Training- und Erholungsbericht jeden Sonntag.",
    sessionReminder:"Sitzungserinnerung",
    sessionReminderDesc:"TÃ¤gliche Erinnerung zum Erfassen deines Status.",
    deviceSync:"GerÃ¤tesync-Benachrichtigungen",
    deviceSyncDesc:"Benachrichtigen wenn eine Synchronisierung abgeschlossen ist oder fehlschlÃ¤gt.",
    shareReadiness:"Bereitschaftspunkte teilen",
    shareReadinessDesc:"Der Trainer sieht deinen tÃ¤glichen Bereitschaftsring und Score.",
    shareBiometrics:"Biometrische Daten teilen",
    shareBiometricsDesc:"HRV, Ruheherzfrequenz und Schlafdaten.",
    shareWorkouts:"Trainingshistorie teilen",
    shareWorkoutsDesc:"Dem Trainer erlauben, deine aufgezeichneten Sitzungen zu sehen.",
    analytics:"Analysen und Verbesserungen",
    analyticsDesc:"Helfen Recovo mit anonymisierten Nutzungsdaten zu verbessern.",
    twoFactor:"Zwei-Faktor-Authentifizierung",
    twoFactorDesc:"Einen Code zusÃ¤tzlich zum Passwort beim Anmelden verlangen.",
    loginAlerts:"Anmelde-Benachrichtigungen",
    loginAlertsDesc:"Ãœber neue Anmeldungen am Konto benachrichtigt werden.",
    lightMode:"Hellmodus", darkMode:"Dunkelmodus", systemTheme:"Systemstandard",
    weight:"Gewicht", distance:"Entfernung", temperature:"Temperatur",
    emailAddress:"E-Mail-Adresse", password:"Passwort",
    accountType:"Kontotyp", dataPrivacy:"Daten und Datenschutz",
    dataPrivacyDesc:"Deine Gesundheitsdaten werden lokal gespeichert und ohne Zustimmung nie geteilt.",
    fullName:"VollstÃ¤ndiger Name", age:"Alter", height:"GrÃ¶ÃŸe (cm)",
    bodyWeight:"Gewicht (kg)", sport:"Sport", team:"Mannschaft / Verein",
    editProfile:"Profil bearbeiten", changePassword:"Passwort Ã¤ndern",
    changeEmail:"E-Mail Ã¤ndern", deleteAccount:"Konto lÃ¶schen",
    support:"Support und Feedback",
    signIn:"Anmelden", signUp:"Konto erstellen", signOut:"Abmelden",
    email:"E-Mail", name:"VollstÃ¤ndiger Name",
    noData:"Noch keine Daten", noWorkouts:"Noch keine Trainingseinheiten.",
    noReadiness:"Keine Bereitschaftsdaten.", noAthletes:"Noch keine Athleten.",
    version:"Version", build:"Build", platform:"Plattform",
    storage:"Speicher", clearCache:"Cache leeren", exportData:"Meine Daten exportieren",
    about:"Ãœber",
  },
  hi: {
    dashboard:"à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡", tracks:"à¤Ÿà¥à¤°à¥ˆà¤•à¥à¤¸", recovery:"à¤°à¤¿à¤•à¤µà¤°à¥€",
    injuries:"à¤šà¥‹à¤Ÿà¥‡à¤‚", daily:"à¤¦à¥ˆà¤¨à¤¿à¤• à¤¸à¥à¤¥à¤¿à¤¤à¤¿", legion:"à¤²à¥€à¤œà¤¨",
    devices:"à¤‰à¤ªà¤•à¤°à¤£", profile:"à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤²", settings:"à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸",
    athletes:"à¤à¤¥à¤²à¥€à¤Ÿ", readiness:"à¤¤à¤¤à¥à¤ªà¤°à¤¤à¤¾",
    save:"à¤¬à¤¦à¤²à¤¾à¤µ à¤¸à¤¹à¥‡à¤œà¥‡à¤‚", cancel:"à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚", edit:"à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤•à¤°à¥‡à¤‚", delete:"à¤¹à¤Ÿà¤¾à¤à¤‚",
    confirm:"à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¥‡à¤‚", loading:"à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ…", retry:"à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸",
    connect:"à¤•à¤¨à¥‡à¤•à¥à¤Ÿ à¤•à¤°à¥‡à¤‚", disconnect:"à¤¡à¤¿à¤¸à¥à¤•à¤¨à¥‡à¤•à¥à¤Ÿ à¤•à¤°à¥‡à¤‚", sync:"à¤¸à¤¿à¤‚à¤• à¤•à¤°à¥‡à¤‚",
    close:"à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚", back:"à¤µà¤¾à¤ªà¤¸", next:"à¤œà¤¾à¤°à¥€ à¤°à¤–à¥‡à¤‚", finish:"à¤¸à¤®à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚",
    settingsTitle:"à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸", notifications:"à¤¸à¥‚à¤šà¤¨à¤¾à¤à¤‚",
    privacy:"à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾", account:"à¤–à¤¾à¤¤à¤¾", security:"à¤¸à¥à¤°à¤•à¥à¤·à¤¾",
    language:"à¤­à¤¾à¤·à¤¾", theme:"à¤¥à¥€à¤®", units:"à¤‡à¤•à¤¾à¤‡à¤¯à¤¾à¤",
    appearance:"à¤¦à¤¿à¤–à¤¾à¤µà¤Ÿ", connectedDevices:"à¤œà¥à¤¡à¤¼à¥‡ à¤‰à¤ªà¤•à¤°à¤£",
    dailyReadiness:"à¤¦à¥ˆà¤¨à¤¿à¤• à¤¤à¤¤à¥à¤ªà¤°à¤¤à¤¾ à¤…à¤²à¤°à¥à¤Ÿ",
    dailyReadinessDesc:"à¤œà¤¬ à¤†à¤ªà¤•à¤¾ à¤¸à¥à¤•à¥‹à¤° à¤¤à¥ˆà¤¯à¤¾à¤° à¤¹à¥‹ à¤¤à¥‹ à¤¸à¥à¤¬à¤¹ à¤•à¥€ à¤¸à¥‚à¤šà¤¨à¤¾à¥¤",
    coachAlerts:"à¤•à¥‹à¤š à¤¸à¤‚à¤¦à¥‡à¤¶",
    coachAlertsDesc:"à¤²à¥€à¤œà¤¨ à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡ à¤•à¥‡ à¤®à¤¾à¤§à¥à¤¯à¤® à¤¸à¥‡ à¤†à¤ªà¤•à¥‡ à¤•à¥‹à¤š à¤¸à¥‡ à¤…à¤²à¤°à¥à¤Ÿà¥¤",
    injuryWarnings:"à¤šà¥‹à¤Ÿ à¤œà¥‹à¤–à¤¿à¤® à¤šà¥‡à¤¤à¤¾à¤µà¤¨à¤¿à¤¯à¤¾à¤",
    injuryWarningsDesc:"à¤•à¤¾à¤‡à¤¨à¥‡à¤Ÿà¤¿à¤• à¤‡à¤‚à¤œà¤¨ à¤¸à¥‡ à¤®à¤¹à¤¤à¥à¤µà¤ªà¥‚à¤°à¥à¤£ à¤…à¤²à¤°à¥à¤Ÿà¥¤",
    weeklyReport:"à¤¸à¤¾à¤ªà¥à¤¤à¤¾à¤¹à¤¿à¤• à¤¸à¤¾à¤°à¤¾à¤‚à¤¶",
    weeklyReportDesc:"à¤¹à¤° à¤°à¤µà¤¿à¤µà¤¾à¤° à¤ªà¥à¤°à¤¶à¤¿à¤•à¥à¤·à¤£ à¤”à¤° à¤°à¤¿à¤•à¤µà¤°à¥€ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿà¥¤",
    sessionReminder:"à¤¸à¤¤à¥à¤° à¤…à¤¨à¥à¤¸à¥à¤®à¤¾à¤°à¤•",
    sessionReminderDesc:"à¤†à¤ªà¤•à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤²à¥‰à¤— à¤•à¤°à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤¦à¥ˆà¤¨à¤¿à¤• à¤¸à¤‚à¤•à¥‡à¤¤à¥¤",
    deviceSync:"à¤¡à¤¿à¤µà¤¾à¤‡à¤¸ à¤¸à¤¿à¤‚à¤• à¤…à¤²à¤°à¥à¤Ÿ",
    deviceSyncDesc:"à¤¸à¤¿à¤‚à¤• à¤ªà¥‚à¤°à¤¾ à¤¹à¥‹à¤¨à¥‡ à¤¯à¤¾ à¤µà¤¿à¤«à¤² à¤¹à¥‹à¤¨à¥‡ à¤ªà¤° à¤¸à¥‚à¤šà¤¿à¤¤ à¤•à¤°à¥‡à¤‚à¥¤",
    shareReadiness:"à¤¤à¤¤à¥à¤ªà¤°à¤¤à¤¾ à¤¸à¥à¤•à¥‹à¤° à¤¸à¤¾à¤à¤¾ à¤•à¤°à¥‡à¤‚",
    shareReadinessDesc:"à¤•à¥‹à¤š à¤†à¤ªà¤•à¥€ à¤¦à¥ˆà¤¨à¤¿à¤• à¤¤à¤¤à¥à¤ªà¤°à¤¤à¤¾ à¤°à¤¿à¤‚à¤— à¤”à¤° à¤¸à¥à¤•à¥‹à¤° à¤¦à¥‡à¤–à¤¤à¤¾ à¤¹à¥ˆà¥¤",
    shareBiometrics:"à¤¬à¤¾à¤¯à¥‹à¤®à¥‡à¤Ÿà¥à¤°à¤¿à¤•à¥à¤¸ à¤¸à¤¾à¤à¤¾ à¤•à¤°à¥‡à¤‚",
    shareBiometricsDesc:"HRV, à¤†à¤°à¤¾à¤® à¤•à¥€ à¤¹à¥ƒà¤¦à¤¯ à¤—à¤¤à¤¿ à¤”à¤° à¤¨à¥€à¤‚à¤¦ à¤¡à¥‡à¤Ÿà¤¾à¥¤",
    shareWorkouts:"à¤µà¤°à¥à¤•à¤†à¤‰à¤Ÿ à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸ à¤¸à¤¾à¤à¤¾ à¤•à¤°à¥‡à¤‚",
    shareWorkoutsDesc:"à¤…à¤ªà¤¨à¥‡ à¤•à¥‹à¤š à¤•à¥‹ à¤†à¤ªà¤•à¥‡ à¤²à¥‰à¤— à¤•à¤¿à¤ à¤—à¤ à¤¸à¤¤à¥à¤° à¤¦à¥‡à¤–à¤¨à¥‡ à¤•à¥€ à¤…à¤¨à¥à¤®à¤¤à¤¿ à¤¦à¥‡à¤‚à¥¤",
    analytics:"à¤µà¤¿à¤¶à¥à¤²à¥‡à¤·à¤£ à¤”à¤° à¤¸à¥à¤§à¤¾à¤°",
    analyticsDesc:"à¤…à¤¨à¤¾à¤® à¤‰à¤ªà¤¯à¥‹à¤— à¤¡à¥‡à¤Ÿà¤¾ à¤•à¥‡ à¤¸à¤¾à¤¥ Recovo à¤•à¥‹ à¤¬à¥‡à¤¹à¤¤à¤° à¤¬à¤¨à¤¾à¤¨à¥‡ à¤®à¥‡à¤‚ à¤®à¤¦à¤¦ à¤•à¤°à¥‡à¤‚à¥¤",
    twoFactor:"à¤¦à¥‹-à¤•à¤¾à¤°à¤• à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£",
    twoFactorDesc:"à¤¸à¤¾à¤‡à¤¨ à¤‡à¤¨ à¤•à¤°à¤¤à¥‡ à¤¸à¤®à¤¯ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤•à¥‡ à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤•à¥‹à¤¡ à¤•à¥€ à¤†à¤µà¤¶à¥à¤¯à¤•à¤¤à¤¾à¥¤",
    loginAlerts:"à¤²à¥‰à¤—à¤¿à¤¨ à¤…à¤²à¤°à¥à¤Ÿ",
    loginAlertsDesc:"à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤¨à¤ à¤¸à¤¾à¤‡à¤¨-à¤‡à¤¨ à¤•à¥€ à¤¸à¥‚à¤šà¤¨à¤¾ à¤ªà¤¾à¤à¤‚à¥¤",
    lightMode:"à¤²à¤¾à¤‡à¤Ÿ à¤®à¥‹à¤¡", darkMode:"à¤¡à¤¾à¤°à¥à¤• à¤®à¥‹à¤¡", systemTheme:"à¤¸à¤¿à¤¸à¥à¤Ÿà¤® à¤¡à¤¿à¤«à¤¼à¥‰à¤²à¥à¤Ÿ",
    weight:"à¤µà¤œà¤¨", distance:"à¤¦à¥‚à¤°à¥€", temperature:"à¤¤à¤¾à¤ªà¤®à¤¾à¤¨",
    emailAddress:"à¤ˆà¤®à¥‡à¤² à¤ªà¤¤à¤¾", password:"à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
    accountType:"à¤–à¤¾à¤¤à¤¾ à¤ªà¥à¤°à¤•à¤¾à¤°", dataPrivacy:"à¤¡à¥‡à¤Ÿà¤¾ à¤”à¤° à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾",
    dataPrivacyDesc:"à¤†à¤ªà¤•à¤¾ à¤¸à¥à¤µà¤¾à¤¸à¥à¤¥à¥à¤¯ à¤¡à¥‡à¤Ÿà¤¾ à¤¸à¥à¤¥à¤¾à¤¨à¥€à¤¯ à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤‚à¤—à¥à¤°à¤¹à¥€à¤¤ à¤¹à¥ˆ à¤”à¤° à¤¬à¤¿à¤¨à¤¾ à¤¸à¤¹à¤®à¤¤à¤¿ à¤•à¥‡ à¤•à¤­à¥€ à¤¸à¤¾à¤à¤¾ à¤¨à¤¹à¥€à¤‚ à¤•à¤¿à¤¯à¤¾ à¤œà¤¾à¤¤à¤¾à¥¤",
    fullName:"à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤®", age:"à¤‰à¤®à¥à¤°", height:"à¤Šà¤‚à¤šà¤¾à¤ˆ (à¤¸à¥‡à¤®à¥€)",
    bodyWeight:"à¤µà¤œà¤¨ (à¤•à¤¿à¤—à¥à¤°à¤¾)", sport:"à¤–à¥‡à¤²", team:"à¤Ÿà¥€à¤® / à¤•à¥à¤²à¤¬",
    editProfile:"à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤² à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤•à¤°à¥‡à¤‚", changePassword:"à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¬à¤¦à¤²à¥‡à¤‚",
    changeEmail:"à¤ˆà¤®à¥‡à¤² à¤¬à¤¦à¤²à¥‡à¤‚", deleteAccount:"à¤–à¤¾à¤¤à¤¾ à¤¹à¤Ÿà¤¾à¤à¤‚",
    support:"à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤”à¤° à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾",
    signIn:"à¤¸à¤¾à¤‡à¤¨ à¤‡à¤¨", signUp:"à¤–à¤¾à¤¤à¤¾ à¤¬à¤¨à¤¾à¤à¤‚", signOut:"à¤¸à¤¾à¤‡à¤¨ à¤†à¤‰à¤Ÿ",
    email:"à¤ˆà¤®à¥‡à¤²", name:"à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤®",
    noData:"à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤¡à¥‡à¤Ÿà¤¾ à¤¨à¤¹à¥€à¤‚", noWorkouts:"à¤•à¥‹à¤ˆ à¤µà¤°à¥à¤•à¤†à¤‰à¤Ÿ à¤²à¥‰à¤— à¤¨à¤¹à¥€à¤‚à¥¤",
    noReadiness:"à¤•à¥‹à¤ˆ à¤¤à¤¤à¥à¤ªà¤°à¤¤à¤¾ à¤¡à¥‡à¤Ÿà¤¾ à¤¨à¤¹à¥€à¤‚à¥¤", noAthletes:"à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤à¤¥à¤²à¥€à¤Ÿ à¤¨à¤¹à¥€à¤‚à¥¤",
    version:"à¤¸à¤‚à¤¸à¥à¤•à¤°à¤£", build:"à¤¬à¤¿à¤²à¥à¤¡", platform:"à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤®",
    storage:"à¤­à¤‚à¤¡à¤¾à¤°à¤£", clearCache:"à¤•à¥ˆà¤¶ à¤¸à¤¾à¤«à¤¼ à¤•à¤°à¥‡à¤‚", exportData:"à¤®à¥‡à¤°à¤¾ à¤¡à¥‡à¤Ÿà¤¾ à¤¨à¤¿à¤°à¥à¤¯à¤¾à¤¤ à¤•à¤°à¥‡à¤‚",
    about:"à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚",
  },
};

const LangContext = createContext({ lang: "en", t: (k) => k });

function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return StorageService.get("lang") || navigator.language?.split("-")[0] || "en";
  });
  const t = useCallback((key) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  }, [lang]);
  const switchLang = useCallback((l) => {
    StorageService.set("lang", l);
    setLang(l);
  }, []);
  return <LangContext.Provider value={{ lang, t, switchLang }}>{children}</LangContext.Provider>;
}

function useLang() { return useContext(LangContext); }

/* ═══════════════════════════════════════════════════════════
   THEME SYSTEM
═══════════════════════════════════════════════════════════ */

const ThemeContext = createContext({ theme: "light", setTheme: () => {} });

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = StorageService.get("theme");
    if (stored) return stored;
    if (typeof window !== "undefined") {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  const setTheme = useCallback((t) => {
    const resolved = t === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : t;
    StorageService.set("theme", t);
    StorageService.set("theme_resolved", resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    setThemeState(t);
  }, []);

  useEffect(() => {
    const resolved = theme === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.setAttribute("data-theme", resolved);

    // Listen for system changes when theme=system
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e) => {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

function useTheme() { return useContext(ThemeContext); }

const SPORTS=["Football","Basketball","Cricket","Wrestling","Boxing","Cycling","Swimming","Running","Volleyball","Tennis","Badminton","Athletics","MMA","Gymnastics","Rugby","Hockey","Triathlon","Rowing"];
const EX_LIB=["Running","Cycling","Swimming","Weight Training","HIIT","Football","Basketball","Wrestling","Boxing","Yoga","Walking","Rowing","CrossFit","Pilates","Stretching"];
const MET={Running:9.8,Cycling:7.5,Swimming:6.0,"Weight Training":5.0,HIIT:8.0,Football:7.0,Basketball:6.5,Wrestling:6.0,Boxing:7.5,Yoga:3.0,Walking:3.5,Rowing:7.0,CrossFit:7.5,Pilates:3.5,Stretching:2.5};

// Mock athletes removed — real-time roster sync from Firebase is used instead
const INJURIES_DB={
  common:[
    {name:"Hamstring Strain",recovery:"2-6 weeks",severity:"Moderate",desc:"Overstretching or tearing of hamstring muscle fibers. Common in sprinters and footballers.",symptoms:["Sudden sharp pain","Bruising","Weakness"],prevention:["Dynamic warm-up","Progressive loading","Eccentric strengthening"]},
    {name:"Shin Splints",recovery:"4-6 weeks",severity:"Low",desc:"Pain along the shinbone from overtraining on hard surfaces.",symptoms:["Dull ache along shin","Tenderness","Swelling"],prevention:["Gradual volume increase","Footwear assessment","Rest days"]},
    {name:"Ankle Sprain",recovery:"1-3 weeks",severity:"Low",desc:"Ligament injury from sudden inversion of the ankle.",symptoms:["Swelling","Pain on weight-bearing","Bruising"],prevention:["Balance training","Taping","Strength work"]},
  ],
  rare:[
    {name:"Stress Fracture",recovery:"6-12 weeks",severity:"High",desc:"Tiny cracks in bone from repetitive force and overuse.",symptoms:["Localized bone pain","Swelling","Pain at rest"],prevention:["Cross-training","Calcium intake","Load monitoring"]},
    {name:"Osteitis Pubis",recovery:"8-16 weeks",severity:"High",desc:"Inflammation of the pubic symphysis. Common in kicking sports.",symptoms:["Groin pain","Hip rotation pain","Adductor tenderness"],prevention:["Core strengthening","Hip mobility","Avoid overtraining"]},
  ],
  serious:[
    {name:"ACL Tear",recovery:"9-12 months",severity:"Severe",desc:"Complete or partial tear of the anterior cruciate ligament. Requires surgical assessment.",symptoms:["Audible pop","Immediate swelling","Instability"],prevention:["Neuromuscular training","Landing mechanics","ACL protocols"]},
    {name:"Rotator Cuff Tear",recovery:"3-6 months",severity:"Severe",desc:"Tear in the shoulder rotator cuff tendons. Common in overhead athletes.",symptoms:["Persistent shoulder pain","Weakness","Painful arc"],prevention:["Rotator cuff strengthening","Scapular stability","Avoid impingement"]},
  ]
};
const BODY_ZONES=[
  {id:"head",label:"Head",cx:110,cy:32,r:22,risk:"Low"},
  {id:"neck",label:"Neck",cx:110,cy:62,r:10,risk:"Low"},
  {id:"l_shoulder",label:"Shoulder L",cx:75,cy:82,r:16,risk:"Moderate"},
  {id:"r_shoulder",label:"Shoulder R",cx:145,cy:82,r:16,risk:"Moderate"},
  {id:"chest",label:"Chest",cx:110,cy:110,r:24,risk:"Low"},
  {id:"core",label:"Core/Abs",cx:110,cy:148,r:20,risk:"Low"},
  {id:"hip",label:"Hip",cx:110,cy:185,r:18,risk:"Moderate"},
  {id:"l_quad",label:"Quad L",cx:88,cy:225,r:16,risk:"Moderate"},
  {id:"r_quad",label:"Quad R",cx:132,cy:225,r:16,risk:"Moderate"},
  {id:"l_knee",label:"Knee L",cx:88,cy:270,r:13,risk:"High"},
  {id:"r_knee",label:"Knee R",cx:132,cy:270,r:13,risk:"High"},
  {id:"l_shin",label:"Shin L",cx:88,cy:308,r:11,risk:"Moderate"},
  {id:"r_shin",label:"Shin R",cx:132,cy:308,r:11,risk:"Moderate"},
  {id:"l_foot",label:"Foot L",cx:85,cy:350,r:12,risk:"Low"},
  {id:"r_foot",label:"Foot R",cx:135,cy:350,r:12,risk:"Low"},
];
const RISK_DATA={
  head:{risks:[{name:"Concussion",score:20},{name:"Neck Strain",score:15}]},
  neck:{risks:[{name:"Cervical Strain",score:25},{name:"Disc Herniation",score:18}]},
  l_shoulder:{risks:[{name:"Rotator Cuff",score:55},{name:"AC Joint Sprain",score:40}]},
  r_shoulder:{risks:[{name:"Rotator Cuff",score:55},{name:"Impingement",score:45}]},
  chest:{risks:[{name:"Pec Strain",score:30},{name:"Rib Stress",score:20}]},
  core:{risks:[{name:"Core Strain",score:25},{name:"Hernia",score:15}]},
  hip:{risks:[{name:"Hip Flexor Strain",score:45},{name:"Labral Tear",score:30},{name:"Groin Strain",score:40}]},
  l_quad:{risks:[{name:"Quad Strain",score:50},{name:"Rectus Femoris",score:35}]},
  r_quad:{risks:[{name:"Quad Strain",score:50},{name:"Rectus Femoris",score:35}]},
  l_knee:{risks:[{name:"ACL Tear",score:65},{name:"Patellar Tendinitis",score:55},{name:"Meniscus",score:48}]},
  r_knee:{risks:[{name:"ACL Tear",score:65},{name:"Patellar Tendinitis",score:55}]},
  l_shin:{risks:[{name:"Shin Splints",score:60},{name:"Stress Fracture",score:35}]},
  r_shin:{risks:[{name:"Shin Splints",score:60},{name:"Stress Fracture",score:35}]},
  l_foot:{risks:[{name:"Plantar Fasciitis",score:40},{name:"Ankle Sprain",score:55}]},
  r_foot:{risks:[{name:"Plantar Fasciitis",score:40},{name:"Ankle Sprain",score:55}]},
};

function getTier(score){
  if(score==null)return{label:"—",cls:"tier-mod",color:"#D4D4D4"};
  if(score>=85)return{label:"ELITE READY",cls:"tier-elite",color:"#22C55E"};
  if(score>=65)return{label:"READY",cls:"tier-ready",color:"#FFD600"};
  if(score>=45)return{label:"MODERATE",cls:"tier-mod",color:"#F59E0B"};
  if(score>=25)return{label:"LOW",cls:"tier-low",color:"#F97316"};
  return{label:"CRITICAL",cls:"tier-critical",color:"#EF4444"};
}
function riskColor(r){return{Low:"#22C55E",Moderate:"#F59E0B",High:"#F97316",Severe:"#EF4444"}[r]||"#999";}
function inits(n){return(n||"?").split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase();}
function fmtTime(s){return`${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function nowTime(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
function moodCls(v){if(v==="High")return"chip chip-green";if(v==="Low")return"chip chip-red";return"chip chip-yellow";}

function Spin({dark}){return <div className={`spinner${dark?" spinner-dark":""}`}/>;}

function Ring({score,size=120,stroke=8}){
  if(score==null)return(
    <div style={{width:size,height:size,borderRadius:"50%",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text3)"}}>—</span>
    </div>
  );
  const r=(size-stroke*2)/2,circ=2*Math.PI*r,dash=(score/100)*circ,t=getTier(score);
  return(
    <div className="ring-wrap" style={{width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F0" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray 1s ease"}}/>
      </svg>
      <div className="ring-center">
        <div className="ring-score" style={{fontSize:size>100?36:size>60?18:13,color:t.color}}>{score}</div>
        <div className="ring-lbl" style={{fontSize:size>100?8:7}}>READY</div>
      </div>
    </div>
  );
}

function RadarChart({data,size=200}){
  const cx=size/2,cy=size/2,r=size/2-22,keys=Object.keys(data),n=keys.length,ang=(2*Math.PI)/n;
  const pt=(i,val)=>{const a=ang*i-Math.PI/2,rv=r*(val/100);return[cx+rv*Math.cos(a),cy+rv*Math.sin(a)];};
  const gp=(i,p)=>{const a=ang*i-Math.PI/2;return[cx+r*p*Math.cos(a),cy+r*p*Math.sin(a)];};
  const grids=[0.25,0.5,0.75,1].map(p=>keys.map((_,i)=>gp(i,p)).map(([x,y])=>`${x},${y}`).join(" "));
  const dpts=keys.map((_,i)=>pt(i,data[keys[i]]||0));
  return(
    <svg width={size} height={size}>
      {grids.map((pts,gi)=><polygon key={gi} points={pts} fill="none" stroke="#EBEBEB" strokeWidth="1"/>)}
      {keys.map((_,i)=>{const[x2,y2]=gp(i,1);return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#EBEBEB" strokeWidth="1"/>;})}
      <polygon points={dpts.map(([x,y])=>`${x},${y}`).join(" ")} fill="rgba(255,214,0,0.15)" stroke="#FFD600" strokeWidth="2"/>
      {dpts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill="#111"/>)}
      {keys.map((k,i)=>{const[x,y]=gp(i,1.25);return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{fill:"#999",fontSize:9,fontFamily:"'IBM Plex Mono'"}}>{k}</text>;})}
    </svg>
  );
}

function Empty({icon,title,desc,action}){
  return(
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={40} color="var(--text3)" /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
      {action&&<div style={{marginTop:20}}>{action}</div>}
    </div>
  );
}

function LogoutModal({onConfirm,onCancel}){
  return(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Log Out</div>
        <div className="modal-desc">Are you sure you want to log out of Recovo? You can always sign back in.</div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Log Out</button>
        </div>
      </div>
    </div>
  );
}

function LandingPage({onGetStarted}){
  const feats=[
    {ico:"dashboard",t:"Readiness Engine",d:"AI-powered daily readiness scoring based on HRV, sleep quality, and recovery metrics."},
    {ico:"injuries",t:"Injury Prevention",d:"Proactive body-zone risk analysis with prevention protocols before injuries happen."},
    {ico:"tracks",t:"Workout Tracking",d:"Log sessions with automatic calorie calculation using MET-based metabolic formulas."},
    {ico:"devices",t:"Coach Dashboard",d:"Real-time team oversight with per-athlete biometrics, readiness rings, and live alerts."},
    {ico:"daily",t:"Real-Time Analytics",d:"Instant data sync across athlete and coach platforms in under one second."},
    {ico:"recovery",t:"Recovery Intelligence",d:"Structured recovery protocols informed by wearable data and self-reporting."},
  ];
  return(
    <div className="land">
      <nav className="land-nav">
        <div className="land-logo">
          <div className="land-logo-mark">R</div>
          <span className="land-logo-text">RECOVO</span>
        </div>
        <div className="land-nav-links">
          {["Features","How It Works","Pricing","About"].map(l=><button key={l} className="land-nav-link">{l}</button>)}
        </div>
        <div className="land-nav-btns">
          <button className="land-btn-g" style={{fontSize:13,padding:"9px 20px",borderRadius:9}} onClick={onGetStarted}>Log In</button>
          <button className="land-btn-p" style={{fontSize:13,padding:"9px 20px",borderRadius:9}} onClick={onGetStarted}>Get Started</button>
        </div>
      </nav>

      <section className="land-hero">
        <div className="land-glow"/>
        <div className="land-eyebrow">
          <StatusDot status="active" size={6} />
          Elite Athlete Performance Platform
        </div>
        <h1 className="land-h1">Train Smarter.<br/><span>Recover Faster.</span></h1>
        <p className="land-sub">Real-time athlete monitoring, readiness tracking, injury prevention, and coach intelligence — all in one platform.</p>
        <div className="land-btns">
          <button className="land-btn-p" onClick={onGetStarted}>Get Started Free</button>
          <button className="land-btn-g" onClick={onGetStarted}>Coach Dashboard →</button>
        </div>
        <div className="land-mockup">
          <div className="land-mockup-bar">
            <div className="land-mockup-dot" style={{background:"#EF4444"}}/>
            <div className="land-mockup-dot" style={{background:"#F59E0B"}}/>
            <div className="land-mockup-dot" style={{background:"#22C55E"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
            {[["AVG READINESS","—","#FFD600"],["ATHLETES READY","—","#22C55E"],["CRITICAL","—","#EF4444"],["TEAM HRV","—","rgba(255,255,255,0.7)"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"14px 16px",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>{l}</div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:c,letterSpacing:1}}>{v}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:2}}>No data yet</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(255,255,255,0.025)",borderRadius:12,padding:16,border:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",height:110}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:15,letterSpacing:2,color:"rgba(255,255,255,0.18)",marginBottom:5}}>ATHLETE ROSTER</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.18)"}}>Athletes will appear here once they join your Legion</div>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section">
        <div className="land-section-eyebrow">Platform Features</div>
        <h2 className="land-section-h">Everything you need to<br/>optimize performance.</h2>
        <p className="land-section-sub">Built for elite athletes and their coaches. Every feature is purpose-built for performance.</p>
        <div className="land-feat-grid">
          {feats.map(f=>(
            <div key={f.t} className="land-feat-card">
              <div className="land-feat-ico"><Icon name={f.ico} size={20} /></div>
              <div className="land-feat-title">{f.t}</div>
              <div className="land-feat-desc">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:"80px 60px",maxWidth:1180,margin:"0 auto",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="land-section-eyebrow">How It Works</div>
        <h2 className="land-section-h">Four steps to smarter training.</h2>
        <div className="land-steps">
          {[
            {n:"01",t:"Athlete Logs Data",d:"Athletes log workouts, report daily status, and sync wearable biometrics in real time."},
            {n:"02",t:"Readiness Calculated",d:"Our engine computes readiness from HRV, sleep, recovery, and subjective wellness scores."},
            {n:"03",t:"Coach Receives Updates",d:"Coaches see live athlete cards with readiness rings, flags, and daily status reports."},
            {n:"04",t:"Smarter Decisions",d:"Coaches and athletes make data-backed decisions on training load and recovery protocols."},
          ].map(s=>(
            <div key={s.n} className="land-step">
              <div className="land-step-n">{s.n}</div>
              <div className="land-step-title">{s.t}</div>
              <div className="land-step-desc">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:"0 0 80px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="land-alert-section" style={{marginTop:80}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:20,padding:"5px 14px",fontFamily:"'IBM Plex Mono'",fontSize:11,color:"#EF4444",letterSpacing:"1px",textTransform:"uppercase",marginBottom:16}}>
            <StatusDot status="error" size={6} />
            Kinetic Alert Engine
          </div>
          <h2 style={{fontFamily:"'Bebas Neue'",fontSize:"clamp(30px,3vw,42px)",letterSpacing:2,color:"var(--accent-fg)",marginBottom:12}}>Injury Risk. Detected Before It Happens.</h2>
          <p style={{fontSize:15,color:"rgba(255,255,255,0.5)",maxWidth:520,lineHeight:1.7,marginBottom:36}}>The Kinetic Alert Engine continuously monitors pain scores, readiness levels, and training volume. When risk thresholds are crossed, coaches and athletes are notified immediately.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:580}}>
            {[
              {l:"Red Alert",c:"rgba(239,68,68,0.1)",b:"rgba(239,68,68,0.2)",cond:"Pain > 60 AND Readiness < 45 AND Session > 90min",act:"Mandatory rest day enforced",tc:"#EF4444"},
              {l:"Orange Alert",c:"rgba(249,115,22,0.1)",b:"rgba(249,115,22,0.2)",cond:"2 of 3 threshold conditions met",act:"Reduce training volume by 40%",tc:"#F97316"},
            ].map(a=>(
              <div key={a.l} style={{background:a.c,border:`1px solid ${a.b}`,borderRadius:14,padding:"18px 20px"}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:1,color:"var(--accent-fg)",marginBottom:8}}>{a.l}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6,marginBottom:8}}>{a.cond}</div>
                <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:a.tc}}>→ {a.act}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:"80px 60px",maxWidth:1180,margin:"0 auto",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="land-section-eyebrow">Testimonials</div>
        <h2 className="land-section-h">What athletes are saying.</h2>
        <div style={{background:"#0D0D0D",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:48,textAlign:"center"}}>
          <div style={{width:48,height:48,background:"rgba(255,255,255,0.05)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Icon name="help" size={22} color="rgba(255,255,255,0.2)" /></div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:17,letterSpacing:2,color:"rgba(255,255,255,0.2)"}}>TESTIMONIALS COMING SOON</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",marginTop:8}}>Be among the first elite athletes to share your experience.</div>
        </div>
      </section>

      <section style={{padding:"80px 60px",maxWidth:1180,margin:"0 auto",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="land-section-eyebrow">Pricing</div>
        <h2 className="land-section-h">Simple, transparent pricing.</h2>
        <div style={{maxWidth:380}}>
          <div style={{background:"#0D0D0D",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:40,textAlign:"center"}}>
            <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1.5}}>Plans</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:36,color:"rgba(255,255,255,0.18)",letterSpacing:3,margin:"12px 0"}}>COMING SOON</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:20}}>We are finalizing pricing. Early access is free.</div>
            <button className="land-btn-p" style={{width:"100%",borderRadius:10,fontSize:13}} onClick={onGetStarted}>Get Early Access</button>
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-footer-grid">
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div className="land-logo-mark">R</div>
              <div className="land-logo-text">RECOVO</div>
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.65}}>Elite athlete performance platform. Train smarter. Recover faster. Win.</div>
          </div>
          {[
            {h:"Product",links:["Features","Dashboard","Pricing","Changelog"]},
            {h:"Company",links:["About","Blog","Careers","Contact"]},
            {h:"Legal",links:["Privacy Policy","Terms of Service","Cookie Policy"]},
          ].map(col=>(
            <div key={col.h}>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:"rgba(255,255,255,0.35)",marginBottom:14}}>{col.h}</div>
              {col.links.map(l=><button key={l} className="land-footer-link">{l}</button>)}
            </div>
          ))}
        </div>
        <div className="land-footer-bottom">
          <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"rgba(255,255,255,0.3)"}}>Â© 2025 Recovo. All rights reserved.</div>
          <div style={{display:"flex",gap:14}}>
            {["Twitter/X","Instagram","LinkedIn"].map(s=><button key={s} className="land-footer-link" style={{marginBottom:0}}>{s}</button>)}
          </div>
        </div>
      </footer>
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (loading) return;
    setErr("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await AuthService.signUpWithEmail(name, email, pw);
      } else {
        await AuthService.signInWithEmail(email, pw);
      }
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  const googleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      await AuthService.signInWithGoogle();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setErr(e.message || "Google sign-in failed. Please try email.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">R</div>
          <div className="auth-logo-text">RECOVO</div>
        </div>
        <div className="auth-title">{mode === "login" ? "Welcome back." : "Create account."}</div>
        <div className="auth-sub">{mode === "login" ? "Sign in to continue to Recovo." : "Join Recovo and start tracking performance."}</div>
        {err && <div className="auth-error">{err}</div>}
        {mode === "signup" && (
          <div className="input-wrap">
            <label className="input-lbl">Full Name</label>
            <input className="input-field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}
        <div className="input-wrap">
          <label className="input-lbl">Email</label>
          <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-wrap" style={{ marginBottom: 20 }}>
          <label className="input-lbl">Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className="btn btn-primary btn-full btn-lg" onClick={submit} disabled={loading}>
          {loading ? <><Spin />{" "}{mode === "login" ? "Signing in…" : "Creating account…"}</> : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>
        <div className="auth-divider"><div className="auth-divider-line" /><span className="auth-divider-text">or</span><div className="auth-divider-line" /></div>
        <button className="auth-google" onClick={googleLogin} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" /><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" /><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" /><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" /></svg>
          Continue with Google
        </button>
        <div className="auth-switch">
          {mode === "login" ? <>Don't have an account? <a onClick={() => { setMode("signup"); setErr(""); }}>Sign up</a></> : <>Already have an account? <a onClick={() => { setMode("login"); setErr(""); }}>Sign in</a></>}
        </div>
      </div>
    </div>
  );
}


function Onboarding({user,onComplete}){
  const[step,setStep]=useState(0);
  const[role,setRole]=useState(null);
  const[sport,setSport]=useState(null);
  const[weight,setWeight]=useState("");
  const[loading,setLoading]=useState(false);

  const next=async()=>{
    if(step===0&&!role)return;
    if(step===1&&!sport)return;
    if(step===2){
      setLoading(true);
      onComplete({role,sport,weight:weight?parseFloat(weight):null});
      return;
    }
    setStep(s=>s+1);
  };

  return(
    <div className="onboard-page">
      <div className="onboard-card">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32}}>
          <div className="auth-logo-mark">R</div>
          <div className="auth-logo-text">RECOVO</div>
        </div>
        <div className="onboard-step-bar">
          {[0,1,2].map(i=><div key={i} className="onboard-step-dot" style={{background:i<=step?"#111":"var(--border)"}}/>)}
        </div>
        {step===0&&(
          <>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,marginBottom:6}}>I AM A</div>
            <div style={{fontSize:14,color:"var(--text2)",marginBottom:24}}>Choose your role to personalize Recovo</div>
            {[{r:"athlete",ico:"athletes",t:"Athlete",d:"Track performance, recovery and training"},{r:"coach",ico:"legion",t:"Coach",d:"Monitor and manage your team's readiness"}].map(({r,ico,t,d})=>(
              <button key={r} className={`role-btn${role===r?" sel":""}`} onClick={()=>setRole(r)}>
                <div className="role-btn-title" style={{display:"flex",alignItems:"center",gap:8}}><Icon name={ico} size={16} color="var(--text1)" />{t}</div>
                <div className="role-btn-desc">{d}</div>
              </button>
            ))}
          </>
        )}
        {step===1&&(
          <>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,marginBottom:6}}>YOUR SPORT</div>
            <div style={{fontSize:14,color:"var(--text2)",marginBottom:18}}>Select your primary sport</div>
            <div className="sport-grid">
              {SPORTS.map(s=><button key={s} className={`sport-btn${sport===s?" sel":""}`} onClick={()=>setSport(s)}>{s}</button>)}
            </div>
          </>
        )}
        {step===2&&(
          <>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,marginBottom:6}}>{role==="athlete"?"BODY DATA":"ALL SET"}</div>
            <div style={{fontSize:14,color:"var(--text2)",marginBottom:18}}>{role==="athlete"?"Required for calorie calculations":"Your coach workspace is ready"}</div>
            {role==="athlete"&&(
              <div className="input-wrap">
                <label className="input-lbl">Body Weight (kg)</label>
                <input className="input-field" type="number" min="30" max="200" placeholder="75" value={weight} onChange={e=>setWeight(e.target.value)}/>
              </div>
            )}
            <div style={{background:"var(--bg2)",borderRadius:14,padding:16,border:"1px solid var(--border)"}}>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text2)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Profile Summary</div>
              {[["Role",role],["Sport",sport],role==="athlete"&&weight?["Weight",`${weight} kg`]:null].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,color:"var(--text2)"}}>{k}</span>
                  <span style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:10}}>
          {step>0?<button className="btn btn-ghost" onClick={()=>setStep(s=>s-1)}>â† Back</button>:<div/>}
          <button className="btn btn-primary" onClick={next} disabled={loading||(step===0&&!role)||(step===1&&!sport)}>
            {loading?<><Spin/>{" "}Saving…</>:step===2?"Launch Recovo →":"Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AthleteDashboard({profile,workouts,biometrics,legionInfo}){
  const hasW=workouts&&workouts.length>0;
  const hasR=biometrics&&biometrics.readiness!=null;
  const t=hasR?getTier(biometrics.readiness):null;
  const days=["M","T","W","T","F","S","S"];
  return(
    <div>
      <div className="topbar">
        <div>
          <h1>DASHBOARD</h1>
          <div className="topbar-meta">Welcome back, {(profile.name||"Athlete").split(" ")[0]} Â· {profile.sport}</div>
        </div>
        <div className="topbar-right">
          {legionInfo&&<span className="chip chip-black" style={{display:"inline-flex",alignItems:"center",gap:5}}><Icon name="zap" size={10} /> {legionInfo.name}</span>}
        </div>
      </div>
      <div className="g23">
        <div className="card flat">
          <div className="card-lbl">Today's Readiness</div>
          {hasR?(
            <div style={{display:"flex",alignItems:"center",gap:22,marginTop:12}}>
              <Ring score={biometrics.readiness} size={130}/>
              <div style={{flex:1}}>
                <div style={{marginBottom:12}}><span className={t.cls}>{t.label}</span></div>
                {[["HRV",biometrics.hrv?`${biometrics.hrv} ms`:"—"],["RHR",biometrics.rhr?`${biometrics.rhr} bpm`:"—"],["Sleep",biometrics.sleep?`${biometrics.sleep} hrs`:"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)"}}>{k}</span>
                    <span style={{fontFamily:"'IBM Plex Mono'",fontSize:13,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ):(
            <Empty icon="moon" title="NO READINESS DATA" desc="Log your first recovery check-in or sync a wearable to see your readiness score."/>
          )}
        </div>
        <div className="card flat">
          <div className="card-lbl">7-Day Readiness Trend</div>
          {biometrics?.history?.length>0?(
            <div style={{display:"flex",alignItems:"flex-end",gap:8,height:90,marginTop:14}}>
              {biometrics.history.slice(0,7).map((v,i)=>{const tr=getTier(v);return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{width:"100%",background:tr.color,borderRadius:"4px 4px 0 0",height:`${v*0.86}%`,maxHeight:74,minHeight:4,transition:"height 0.5s ease",opacity:0.85}}/>
                  <span style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)"}}>{days[i]}</span>
                </div>
              );})}
            </div>
          ):(
            <Empty icon="barChart" title="NO HISTORY YET" desc="Your readiness history will appear here as you log daily check-ins."/>
          )}
        </div>
      </div>
      <div className="g4">
        {[
          {lbl:"Weekly Calories",val:hasW?workouts.reduce((s,w)=>s+(w.calories||0),0).toLocaleString():"—",sub:"kcal burned"},
          {lbl:"Sessions",val:hasW?workouts.length:"—",sub:"this week"},
          {lbl:"Active Injuries",val:"0",sub:"All clear"},
          {lbl:"Day Streak",val:profile.streak||"—",sub:"consecutive days"},
        ].map((s,i)=>(
          <div key={i} className="card flat">
            <div className="card-lbl">{s.lbl}</div>
            <div className="card-val">{s.val}</div>
            <div className="card-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="card flat">
        <div className="sec-hdr"><div className="sec-title">RECENT WORKOUTS</div></div>
        {hasW?workouts.slice(0,5).map((w,i)=>(
          <div key={i} className="workout-row">
            <div className="workout-ico"><Icon name={w.icon || "dumbbell"} size={17} /></div>
            <div>
              <div className="workout-name">{w.name}</div>
              <div className="workout-meta">{w.date} Â· {w.duration}</div>
            </div>
            {w.calories?<div className="workout-cal">{w.calories} kcal</div>:null}
          </div>
        )):(
          <Empty icon="dumbbell" title="NO WORKOUTS YET" desc="Start your first session in the Tracks tab to see your workout history here."/>
        )}
      </div>
    </div>
  );
}

function TracksPage({profile,workouts,setWorkouts}){
  const[running,setRunning]=useState(false);
  const[secs,setSecs]=useState(0);
  const[exercises,setExercises]=useState([]);
  const[showLib,setShowLib]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const timerRef=useRef();
  const bw=profile?.weight||75;

  useEffect(()=>{
    if(running){timerRef.current=setInterval(()=>setSecs(s=>s+1),1000);}
    else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[running]);

  const totalCal=running&&exercises.length?Math.round(exercises.reduce((sum,ex)=>{const m=MET[ex.name]||5;return sum+m*bw*(secs/3600/exercises.length);},0)):0;

  const finish=async()=>{
    if(!exercises.length)return;
    setSaving(true);
    try {
      const session={name:exercises[0].name+(exercises.length>1?` + ${exercises.length-1} more`:""),icon:"dumbbell",date:new Date().toLocaleDateString([],{month:"short",day:"numeric"}),duration:`${Math.floor(secs/60)} min`,calories:totalCal,exercises:exercises.map(e=>e.name),timestamp:Date.now(),uid:profile.id};
      const newRef=push(ref(db,`workouts/${profile.id}`));
      await set(newRef,{...session,id:newRef.key});
      session.id=newRef.key;
      setWorkouts(p=>[session,...(p||[])]);
      setRunning(false);setSecs(0);setExercises([]);setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    } catch(e) { console.error('Failed to save workout:', e); }
    setSaving(false);
  };

  return(
    <div>
      <div className="topbar">
        <div><h1>TRACKS</h1><div className="topbar-meta">WORKOUT LOGGER Â· SESSION TRACKER</div></div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowLib(!showLib)}>Exercise Library</button>
          {!running
            ?<button className="btn btn-primary" onClick={()=>{setRunning(true);setSecs(0);}}>â–¶ Start Session</button>
            :<button className="btn" style={{background:"var(--red)",color:"var(--accent-fg)"}} onClick={()=>setRunning(false)}>Pause</button>
          }
          {running&&exercises.length>0&&<button className="btn btn-yellow" onClick={finish} disabled={saving}>{saving?<><Spin dark/>{" "}Saving…</>:"Finish Session"}</button>}
        </div>
      </div>
      {saved&&<div className="alert-banner alert-green"><div className="alert-dot"/><div><div className="alert-title">SESSION SAVED</div><div className="alert-desc">Your workout has been logged successfully.</div></div></div>}
      <div className="g3">
        <div className="card flat" style={{textAlign:"center"}}>
          <div className="card-lbl">Session Timer</div>
          <div className="timer-display" style={{fontSize:44,margin:"8px 0",color:running?"var(--text1)":"var(--text3)"}}>{fmtTime(secs)}</div>
          <div className="card-sub">{running?"â— LIVE RECORDING":"Press Start to begin"}</div>
        </div>
        <div className="card flat" style={{textAlign:"center"}}>
          <div className="card-lbl">Live Calories</div>
          <div className="card-val" style={{fontSize:44,margin:"8px 0"}}>{running?totalCal:"—"}</div>
          <div className="card-sub">kcal estimated</div>
        </div>
        <div className="card flat" style={{textAlign:"center"}}>
          <div className="card-lbl">Total Sets</div>
          <div className="card-val" style={{fontSize:44,margin:"8px 0"}}>{exercises.reduce((s,e)=>s+(e.sets||0),0)||"—"}</div>
          <div className="card-sub">{exercises.length} exercises logged</div>
        </div>
      </div>
      {showLib&&(
        <div className="card flat" style={{marginBottom:16}}>
          <div className="sec-hdr"><div className="sec-title">EXERCISE LIBRARY</div><span className="sec-action" onClick={()=>setShowLib(false)}>Close</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {EX_LIB.map(ex=>(
              <button key={ex} className="btn btn-ghost btn-sm" onClick={()=>{setExercises(p=>[...p,{id:Date.now()+(Math.random()*1000|0),name:ex,sets:3,reps:10,weight:0}]);setShowLib(false);}}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card flat">
        <div className="sec-hdr">
          <div className="sec-title">EXERCISE LOG</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setExercises(p=>[...p,{id:Date.now()+(Math.random()*1000|0),name:"New Exercise",sets:3,reps:10,weight:0}])}>+ Add Exercise</button>
        </div>
        {exercises.length>0?(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
              {["Exercise","Sets","Reps","Weight (kg)","Cal Est.",""].map(h=><th key={h} style={{fontFamily:"'IBM Plex Mono'",fontSize:10,textTransform:"uppercase",letterSpacing:"1px",color:"var(--text2)",padding:"8px 6px",textAlign:"left"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {exercises.map((ex,i)=>{
                const cal=running?Math.round((MET[ex.name]||5)*bw*0.5):"—";
                return(
                  <tr key={ex.id} style={{borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"10px 6px",fontWeight:600,fontSize:13}}>{ex.name}</td>
                    {["sets","reps","weight"].map(f=>(
                      <td key={f} style={{padding:"10px 6px"}}>
                        <input className="ex-input" type="number" min="0" value={ex[f]}
                          onChange={e=>setExercises(p=>p.map((x,j)=>j===i?{...x,[f]:+e.target.value}:x))}/>
                      </td>
                    ))}
                    <td style={{padding:"10px 6px",fontFamily:"'IBM Plex Mono'",fontSize:12,fontWeight:700}}>{cal}</td>
                    <td style={{padding:"10px 6px"}}>
                      <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px",fontSize:12}} onClick={()=>setExercises(p=>p.filter((_,j)=>j!==i))}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ):(
          <Empty icon="edit" title="NO EXERCISES ADDED" desc="Add exercises from the library or click + Add Exercise to start logging your session."/>
        )}
      </div>
      <div className="card flat" style={{marginTop:16}}>
        <div className="sec-hdr"><div className="sec-title">WORKOUT HISTORY</div></div>
        {workouts&&workouts.length>0?workouts.map((w,i)=>(
          <div key={i} className="workout-row">
            <div className="workout-ico"><Icon name={w.icon || "dumbbell"} size={17} /></div>
            <div><div className="workout-name">{w.name}</div><div className="workout-meta">{w.date} Â· {w.duration}</div></div>
            {w.calories?<div className="workout-cal">{w.calories} kcal</div>:null}
          </div>
        )):(
          <Empty icon="barChart" title="NO WORKOUT HISTORY" desc="Sessions you finish will be saved here automatically."/>
        )}
      </div>
    </div>
  );
}

function RecoveryPage({profile,biometrics,setBiometrics}){
  const[selMuscle,setSelMuscle]=useState(null);
  const[view,setView]=useState("front"); // front | back
  const[zoom,setZoom]=useState(1);
  const[rotating,setRotating]=useState(false);
  const[dragStart,setDragStart]=useState(null);
  const[rotateX,setRotateX]=useState(0);
  const[injTab,setInjTab]=useState("common");
  const svgRef=useRef();

  // Auto-rotate when not interacting
  const rotRef=useRef(0);
  const animRef=useRef();
  useEffect(()=>{
    if(rotating){
      const tick=()=>{
        rotRef.current=(rotRef.current+0.4)%360;
        if(svgRef.current) svgRef.current.style.transform=`rotateY(${rotRef.current}deg) rotateX(${rotateX}deg) scale(${zoom})`;
        animRef.current=requestAnimationFrame(tick);
      };
      animRef.current=requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return ()=>cancelAnimationFrame(animRef.current);
  },[rotating,rotateX,zoom]);

  const syncWearable=()=>{
    const hrv=Math.round(55+Math.random()*25),rhr=Math.round(48+Math.random()*18),sleep=Math.round((6+Math.random()*3)*10)/10;
    const readiness=Math.min(100,Math.round((hrv/80*50)+(sleep/9*30)+20+Math.random()*10));
    const history=[...(biometrics?.history||[]),readiness].slice(-7);
    setBiometrics(p=>({...p,hrv,rhr,sleep,readiness,history}));
  };

  // All clickable muscle groups with SVG path data — front view
  const FRONT_MUSCLES=[
    {id:"trapezius_f",label:"Trapezius",group:"Neck & Shoulders",risk:"Moderate",
     path:"M140,38 C155,42 175,55 178,72 C168,68 158,65 148,62 C145,52 143,45 140,38 Z M80,38 C65,42 45,55 42,72 C52,68 62,65 72,62 C75,52 77,45 80,38 Z"},
    {id:"pec_major",label:"Pectoralis Major",group:"Chest",risk:"Low",
     path:"M110,75 C125,72 148,78 155,98 C148,105 138,108 128,106 C120,100 114,90 110,75 Z M110,75 C95,72 72,78 65,98 C72,105 82,108 92,106 C100,100 106,90 110,75 Z"},
    {id:"deltoid_f",label:"Deltoid (Front)",group:"Shoulders",risk:"Moderate",
     path:"M155,68 C168,60 178,68 178,82 C174,90 166,94 158,90 C155,82 154,74 155,68 Z M65,68 C52,60 42,68 42,82 C46,90 54,94 62,90 C65,82 66,74 65,68 Z"},
    {id:"biceps",label:"Biceps",group:"Arms",risk:"Low",
     path:"M162,94 C170,98 174,112 170,126 C164,124 158,118 156,110 C157,102 159,97 162,94 Z M58,94 C50,98 46,112 50,126 C56,124 62,118 64,110 C63,102 61,97 58,94 Z"},
    {id:"forearm_f",label:"Forearm (Front)",group:"Arms",risk:"Low",
     path:"M170,128 C174,132 174,150 168,164 C162,160 158,150 158,140 C162,134 166,130 170,128 Z M50,128 C46,132 46,150 52,164 C58,160 62,150 62,140 C58,134 54,130 50,128 Z"},
    {id:"rectus_abdominis",label:"Rectus Abdominis",group:"Core",risk:"Low",
     path:"M100,112 C105,110 115,110 120,112 L122,145 C118,147 112,148 108,148 Z"},
    {id:"obliques",label:"Obliques",group:"Core",risk:"Low",
     path:"M120,112 C130,115 140,122 142,138 C135,145 126,148 122,145 Z M100,112 C90,115 80,122 78,138 C85,145 94,148 98,145 Z"},
    {id:"hip_flexor",label:"Hip Flexor",group:"Hips",risk:"High",
     path:"M100,158 C92,158 80,162 76,175 C82,180 90,182 98,180 C100,173 100,165 100,158 Z M120,158 C128,158 140,162 144,175 C138,180 130,182 122,180 C120,173 120,165 120,158 Z"},
    {id:"quad",label:"Quadriceps",group:"Legs",risk:"High",
     path:"M95,182 C86,184 76,198 74,220 C72,238 74,254 78,264 C84,256 90,244 94,230 C96,214 96,198 95,182 Z M125,182 C134,184 144,198 146,220 C148,238 146,254 142,264 C136,256 130,244 126,230 C124,214 124,198 125,182 Z"},
    {id:"knee",label:"Knee",group:"Joints",risk:"Severe",
     path:"M82,264 C80,272 80,280 84,286 C92,288 98,284 100,278 C98,270 92,264 82,264 Z M138,264 C140,272 140,280 136,286 C128,288 122,284 120,278 C122,270 128,264 138,264 Z"},
    {id:"tibialis",label:"Tibialis Anterior",group:"Lower Legs",risk:"Moderate",
     path:"M84,288 C80,296 78,310 80,330 C86,334 92,334 96,330 C96,314 92,300 84,288 Z M136,288 C140,296 142,310 140,330 C134,334 128,334 124,330 C124,314 128,300 136,288 Z"},
    {id:"foot_f",label:"Foot",group:"Foot & Ankle",risk:"Moderate",
     path:"M78,332 C74,340 74,350 80,356 C88,360 98,358 100,352 C98,344 88,336 78,332 Z M142,332 C146,340 146,350 140,356 C132,360 122,358 120,352 C122,344 132,336 142,332 Z"},
  ];

  const BACK_MUSCLES=[
    {id:"trapezius_b",label:"Trapezius",group:"Back",risk:"High",
     path:"M110,38 C128,42 155,55 162,78 C145,82 128,80 110,78 C92,80 75,82 58,78 C65,55 92,42 110,38 Z"},
    {id:"rhomboids",label:"Rhomboids",group:"Back",risk:"Moderate",
     path:"M110,80 C124,80 138,86 142,100 C130,108 120,110 110,108 C100,110 90,108 78,100 C82,86 96,80 110,80 Z"},
    {id:"lat",label:"Latissimus Dorsi",group:"Back",risk:"Moderate",
     path:"M152,90 C168,96 178,115 175,140 C164,148 152,148 144,140 C140,122 142,104 152,90 Z M68,90 C52,96 42,115 45,140 C56,148 68,148 76,140 C80,122 78,104 68,90 Z"},
    {id:"deltoid_b",label:"Deltoid (Rear)",group:"Shoulders",risk:"Moderate",
     path:"M158,66 C170,60 180,72 176,88 C168,90 160,86 156,80 C155,74 156,69 158,66 Z M62,66 C50,60 40,72 44,88 C52,90 60,86 64,80 C65,74 64,69 62,66 Z"},
    {id:"triceps",label:"Triceps",group:"Arms",risk:"Low",
     path:"M176,90 C180,100 178,118 172,130 C166,128 162,118 162,108 C164,98 170,92 176,90 Z M44,90 C40,100 42,118 48,130 C54,128 58,118 58,108 C56,98 50,92 44,90 Z"},
    {id:"forearm_b",label:"Forearm (Rear)",group:"Arms",risk:"Low",
     path:"M172,132 C176,140 176,158 168,170 C162,166 160,154 162,142 C165,136 168,132 172,132 Z M48,132 C44,140 44,158 52,170 C58,166 60,154 58,142 C55,136 52,132 48,132 Z"},
    {id:"lower_back",label:"Lower Back / Erectors",group:"Core & Back",risk:"Severe",
     path:"M110,110 C122,112 136,118 140,138 C134,148 124,152 110,150 C96,152 86,148 80,138 C84,118 98,112 110,110 Z"},
    {id:"glutes",label:"Gluteus",group:"Glutes",risk:"Low",
     path:"M110,155 C128,155 148,165 152,185 C142,196 128,198 110,196 C92,198 78,196 68,185 C72,165 92,155 110,155 Z"},
    {id:"hamstrings",label:"Hamstrings",group:"Legs",risk:"High",
     path:"M96,198 C88,202 78,218 76,242 C74,260 76,276 82,284 C88,274 92,260 94,244 C96,228 96,214 96,198 Z M124,198 C132,202 142,218 144,242 C146,260 144,276 138,284 C132,274 128,260 126,244 C124,228 124,214 124,198 Z"},
    {id:"calf",label:"Calf (Gastrocnemius)",group:"Lower Legs",risk:"Moderate",
     path:"M84,286 C80,298 78,316 82,336 C88,340 96,338 98,332 C98,316 94,300 84,286 Z M136,286 C140,298 142,316 138,336 C132,340 124,338 122,332 C122,316 126,300 136,286 Z"},
    {id:"achilles",label:"Achilles Tendon",group:"Lower Legs",risk:"Severe",
     path:"M82,336 C80,344 80,354 84,360 C90,362 100,360 100,354 C100,346 92,340 82,336 Z M138,336 C140,344 140,354 136,360 C130,362 120,360 120,354 C120,346 128,340 138,336 Z"},
  ];

  const muscles = view==="front" ? FRONT_MUSCLES : BACK_MUSCLES;

  const RISK_COLORS={Low:"#22C55E",Moderate:"#F59E0B",High:"#F97316",Severe:"#EF4444"};
  const RISK_BG={Low:"var(--green-bg)",Moderate:"var(--amber-bg)",High:"var(--amber-bg)",Severe:"var(--red-bg)"};
  const RISK_CHIP={Low:"chip chip-green",Moderate:"chip chip-amber",High:"chip chip-orange",Severe:"chip chip-red"};

  const selectedMuscle=muscles.find(m=>m.id===selMuscle);

  // Body outline — front
  const FRONT_OUTLINE="M110,8 C122,8 130,16 132,28 C136,24 140,22 144,26 C146,32 144,40 140,44 C148,50 158,58 162,68 C175,62 184,70 182,84 C186,90 186,100 182,108 C178,116 170,122 162,122 L164,148 C170,148 178,154 178,164 L178,202 C172,200 164,198 158,196 L156,228 C162,236 166,250 164,268 C162,278 156,286 148,288 L146,330 C152,332 156,340 154,350 C152,356 146,360 138,360 L118,360 C112,366 108,366 102,360 L82,360 C74,360 68,356 66,350 C64,340 68,332 74,330 L72,288 C64,286 58,278 56,268 C54,250 58,236 64,228 L62,196 C56,198 48,200 42,202 L42,164 C42,154 50,148 56,148 L58,122 C50,122 42,116 38,108 C34,100 34,90 38,84 C36,70 45,62 58,68 C62,58 72,50 80,44 C76,40 74,32 76,26 C80,22 84,24 88,28 C90,16 98,8 110,8 Z";
  const BACK_OUTLINE="M110,8 C122,8 130,16 132,28 C136,24 140,22 144,26 C146,32 144,40 140,44 C150,50 162,60 166,72 C176,64 186,72 184,86 C188,94 186,106 180,114 C174,120 166,124 158,122 L160,150 C166,152 174,158 174,168 L172,205 C166,202 158,200 152,200 L150,240 C156,248 158,264 154,280 C150,290 142,296 134,296 L132,336 C138,338 142,346 140,356 C138,362 132,366 122,364 L98,364 C88,366 82,362 80,356 C78,346 82,338 88,336 L86,296 C78,296 70,290 66,280 C62,264 64,248 70,240 L68,200 C62,200 54,202 48,205 L46,168 C46,158 54,152 60,150 L62,122 C54,124 46,120 40,114 C34,106 32,94 36,86 C34,72 44,64 54,72 C58,60 70,50 80,44 C76,40 74,32 76,26 C80,22 84,24 88,28 C90,16 98,8 110,8 Z";

  const outline=view==="front"?FRONT_OUTLINE:BACK_OUTLINE;

  const handleMouseDown=(e)=>{
    if(rotating) return;
    const rect=e.currentTarget.getBoundingClientRect();
    setDragStart({x:e.clientX,startRot:rotRef.current});
  };
  const handleMouseMove=(e)=>{
    if(!dragStart||rotating) return;
    const dx=e.clientX-dragStart.x;
    rotRef.current=(dragStart.startRot+dx*0.5)%360;
    if(svgRef.current) svgRef.current.style.transform=`rotateY(${rotRef.current}deg) rotateX(${rotateX}deg) scale(${zoom})`;
  };
  const handleMouseUp=()=>setDragStart(null);

  const handleTouchStart=(e)=>{
    if(e.touches.length===1) setDragStart({x:e.touches[0].clientX,startRot:rotRef.current});
  };
  const handleTouchMove=(e)=>{
    if(!dragStart||e.touches.length!==1) return;
    const dx=e.touches[0].clientX-dragStart.x;
    rotRef.current=(dragStart.startRot+dx*0.5)%360;
    if(svgRef.current) svgRef.current.style.transform=`rotateY(${rotRef.current}deg) rotateX(${rotateX}deg) scale(${zoom})`;
  };

  return(
    <div>
      <div className="topbar">
        <div><h1>RECOVERY</h1><div className="topbar-meta">3D MUSCLE SCANNER Â· INJURY INTELLIGENCE Â· AI COACH</div></div>
      </div>

      {/* ── 3D MUSCLE VIEWER ── */}
      <div className="card flat" style={{marginBottom:16,padding:0,overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"14px 18px",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,flex:1}}>3D MUSCLE SCANNER</div>
          {/* View toggle */}
          <div style={{display:"flex",background:"var(--bg3)",borderRadius:10,padding:3,border:"1px solid var(--border)"}}>
            {["front","back"].map(v=>(
              <button key={v} onClick={()=>{setView(v);setSelMuscle(null);}}
                style={{padding:"6px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'IBM Plex Mono'",
                  background:view===v?"var(--text1)":"transparent",color:view===v?"var(--bg)":"var(--text2)",transition:"all 0.15s"}}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Zoom */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px",minHeight:"auto"}}
              onClick={()=>setZoom(z=>Math.max(0.6,z-0.2))}>âˆ’</button>
            <span style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)",minWidth:36,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
            <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px",minHeight:"auto"}}
              onClick={()=>setZoom(z=>Math.min(2.5,z+0.2))}>+</button>
          </div>
          {/* Auto-rotate */}
          <button className={`btn btn-sm ${rotating?"btn-primary":"btn-ghost"}`}
            style={{fontSize:11,gap:5}} onClick={()=>setRotating(r=>!r)}>
            <Icon name="sync" size={11} />{rotating?"Stop":"Rotate"}
          </button>
          {/* Reset */}
          <button className="btn btn-ghost btn-sm" style={{fontSize:11}}
            onClick={()=>{setZoom(1);setRotateX(0);rotRef.current=0;setRotating(false);setSelMuscle(null);
              if(svgRef.current)svgRef.current.style.transform=`rotateY(0deg) rotateX(0deg) scale(1)`;}}>
            Reset
          </button>
        </div>

        <div style={{display:"flex",gap:0,minHeight:480}}>
          {/* SVG Canvas */}
          <div style={{flex:"0 0 auto",width:300,display:"flex",flexDirection:"column",alignItems:"center",
                       background:"var(--bg2)",perspective:900,cursor:dragStart?"grabbing":"grab",userSelect:"none",
                       borderRight:"1px solid var(--border)"}}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={()=>setDragStart(null)}>

            <div style={{fontSize:11,fontFamily:"'IBM Plex Mono'",color:"var(--text3)",padding:"10px 0 4px",letterSpacing:1}}>
              DRAG TO ROTATE Â· CLICK MUSCLE TO SELECT
            </div>

            <div ref={svgRef} style={{transformStyle:"preserve-3d",transition:rotating?"none":"transform 0.1s",
                                      transform:`rotateY(0deg) rotateX(0deg) scale(${zoom})`}}>
              <svg viewBox="0 0 220 380" width={220} height={370} style={{overflow:"visible",display:"block"}}>
                {/* Body outline */}
                <path d={outline} fill="var(--bg3)" stroke="var(--border2)" strokeWidth="1.5" />

                {/* Muscle groups */}
                {muscles.map(m=>{
                  const isSel=selMuscle===m.id;
                  const rc=RISK_COLORS[m.risk]||"#999";
                  return(
                    <g key={m.id} onClick={e=>{e.stopPropagation();setSelMuscle(isSel?null:m.id);}}
                      style={{cursor:"pointer"}}>
                      {m.path.split("Z").filter(p=>p.trim()).map((seg,i)=>(
                        <path key={i} d={seg+"Z"}
                          fill={isSel?`${rc}55`:`${rc}28`}
                          stroke={isSel?rc:`${rc}70`}
                          strokeWidth={isSel?2:1}
                          style={{transition:"all 0.18s"}}
                        />
                      ))}
                      {isSel && m.path.split("Z").filter(p=>p.trim()).map((seg,i)=>{
                        // draw a subtle inner glow
                        return(
                          <path key={"glow"+i} d={seg+"Z"}
                            fill="none"
                            stroke={rc}
                            strokeWidth={3}
                            opacity={0.25}
                            style={{filter:`blur(2px)`}}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* Click target for deselect */}
                <rect x={0} y={0} width={220} height={380} fill="transparent" onClick={()=>setSelMuscle(null)} />

                {/* Selected label bubble */}
                {selectedMuscle && (()=>{
                  // Find centroid of first path segment
                  const nums=selectedMuscle.path.match(/[\d.]+/g)||[];
                  const cx=parseFloat(nums[0])||110;
                  const cy=parseFloat(nums[1])||100;
                  return(
                    <g>
                      <rect x={cx-42} y={cy-22} width={84} height={18} rx={9}
                        fill="var(--text1)" opacity={0.88}/>
                      <text x={cx} y={cy-10} textAnchor="middle" dominantBaseline="middle"
                        style={{fill:"var(--bg)",fontSize:9,fontFamily:"'IBM Plex Mono'",fontWeight:700,letterSpacing:0.5}}>
                        {selectedMuscle.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:10,padding:"8px 0 14px",flexWrap:"wrap",justifyContent:"center"}}>
              {Object.entries(RISK_COLORS).map(([label,color])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:4}}>
                  <StatusDot status={label==="Low"?"active":label==="Moderate"?"pending":label==="High"?"syncing":"error"} size={6}/>
                  <span style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text2)"}}>{label}</span>
                </div>
              ))}
            </div>

            {/* Muscle group list for quick select */}
            <div style={{width:"100%",padding:"0 12px 14px",display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
              {muscles.map(m=>(
                <button key={m.id}
                  onClick={()=>setSelMuscle(selMuscle===m.id?null:m.id)}
                  style={{padding:"3px 8px",borderRadius:20,border:`1px solid ${selMuscle===m.id?RISK_COLORS[m.risk]:"var(--border)"}`,
                    background:selMuscle===m.id?`${RISK_COLORS[m.risk]}20`:"transparent",
                    fontSize:9,fontFamily:"'IBM Plex Mono'",cursor:"pointer",
                    color:selMuscle===m.id?RISK_COLORS[m.risk]:"var(--text3)",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div style={{flex:1,padding:"20px 22px",overflowY:"auto"}}>
            {selectedMuscle?(
              <>
                {/* Muscle header */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:10}}>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"var(--text1)"}}>
                        {selectedMuscle.label}
                      </div>
                      <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)",marginTop:2}}>
                        {selectedMuscle.group}
                      </div>
                    </div>
                    <span className={RISK_CHIP[selectedMuscle.risk]}>{selectedMuscle.risk} Risk</span>
                  </div>
                  {/* Risk bar */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text2)"}}>INJURY RISK SCORE</span>
                      <span style={{fontFamily:"'IBM Plex Mono'",fontSize:12,fontWeight:700,color:RISK_COLORS[selectedMuscle.risk]}}>
                        {selectedMuscle.risk==="Low"?22:selectedMuscle.risk==="Moderate"?48:selectedMuscle.risk==="High"?71:88}/100
                      </span>
                    </div>
                    <div style={{background:"var(--bg3)",borderRadius:6,height:6}}>
                      <div style={{
                        width:`${selectedMuscle.risk==="Low"?22:selectedMuscle.risk==="Moderate"?48:selectedMuscle.risk==="High"?71:88}%`,
                        height:6,borderRadius:6,
                        background:RISK_COLORS[selectedMuscle.risk],
                        transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)"
                      }}/>
                    </div>
                  </div>
                </div>

                {/* Common injuries for this muscle */}
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>
                    Common Injuries
                  </div>
                  {RISK_DATA[Object.keys(RISK_DATA).find(k=>k.includes(selectedMuscle.id.split("_")[0]))||Object.keys(RISK_DATA)[0]]?.risks?.map((r,i)=>(
                    <div key={i} style={{marginBottom:8,padding:"10px 12px",background:"var(--bg2)",borderRadius:10,border:"1px solid var(--border)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontWeight:600,fontSize:13,color:"var(--text1)"}}>{r.name}</span>
                        <span style={{fontFamily:"'IBM Plex Mono'",fontSize:11,fontWeight:700,color:r.score>60?"var(--accent)":"var(--amber)"}}>{r.score}/100</span>
                      </div>
                      <div style={{background:"var(--bg3)",borderRadius:4,height:3}}>
                        <div style={{width:`${r.score}%`,height:3,borderRadius:4,background:r.score>60?"var(--accent)":"var(--amber)",transition:"width 0.6s"}}/>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recovery tips */}
                <div style={{background:"var(--amber-bg)",border:"1px solid var(--amber-border)",borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--amber)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>
                    Recovery Protocol
                  </div>
                  {[
                    selectedMuscle.risk==="Low"?"Active recovery: light stretching and mobility work.":
                    selectedMuscle.risk==="Moderate"?"Reduce load by 20–30%. Focus on eccentric strengthening.":
                    selectedMuscle.risk==="High"?"Rest required. Ice 15min / 2hr. No high-intensity loading.":
                    "Immediate rest. Consult physiotherapist before resuming training.",
                    "Hydration: 2.5–3L daily to support tissue repair.",
                    "Sleep: minimum 8 hours for full muscular recovery.",
                  ].map((tip,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:5,fontSize:12,color:"var(--text2)",lineHeight:1.5}}>
                      <span style={{color:"var(--accent)",flexShrink:0,fontWeight:700}}>Â·</span>{tip}
                    </div>
                  ))}
                </div>
              </>
            ):(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",minHeight:300,textAlign:"center",padding:"0 24px"}}>
                <div style={{width:64,height:64,background:"var(--bg3)",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,border:"1px solid var(--border)"}}>
                  <Icon name="map" size={28} color="var(--text3)" />
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"var(--text2)",marginBottom:8}}>
                  SELECT A MUSCLE
                </div>
                <div style={{fontSize:13,color:"var(--text3)",lineHeight:1.6,maxWidth:220}}>
                  Tap any highlighted muscle on the body to view injury risk, common injuries, and recovery protocols.
                </div>
                <div style={{marginTop:20,display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                  {["front","back"].map(v=>(
                    <button key={v} className={`btn btn-sm ${view===v?"btn-primary":"btn-ghost"}`}
                      onClick={()=>{setView(v);}} style={{fontSize:11}}>
                      {v==="front"?"Front View":"Back View"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Readiness + AI */}
      <div className="g2" style={{marginBottom:16}}>
        <div className="card flat">
          <div className="card-lbl" style={{marginBottom:10}}>Readiness Engine</div>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <Ring score={biometrics?.readiness} size={88}/>
            <div style={{flex:1}}>
              {[["HRV",biometrics?.hrv?`${biometrics.hrv} ms`:"—"],["RHR",biometrics?.rhr?`${biometrics.rhr} bpm`:"—"],["Sleep",biometrics?.sleep?`${biometrics.sleep} hrs`:"—"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:7,paddingBottom:7,borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text2)"}}>{k}</span>
                  <span style={{fontFamily:"'IBM Plex Mono'",fontSize:12,fontWeight:700,color:"var(--text1)"}}>{v}</span>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm btn-full" style={{marginTop:8}} onClick={syncWearable}>Sync Wearable</button>
            </div>
          </div>
        </div>
        <div className="ai-card">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"var(--text1)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--accent)"}}><Icon name="heartPulse" size={18} /></div>
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,color:"var(--text1)"}}>AI RECOVERY COACH</div>
              <div style={{fontSize:11,color:"var(--text2)"}}>Powered by Recovo Intelligence</div>
            </div>
          </div>
          {biometrics?.readiness!=null?(
            <div className="ai-msg">
              {biometrics.readiness>=85&&"Your readiness is elite today. This is an optimal window for high-intensity work."}
              {biometrics.readiness>=65&&biometrics.readiness<85&&`Good readiness at ${biometrics.readiness}. Moderate-intensity training is ideal today.`}
              {biometrics.readiness>=45&&biometrics.readiness<65&&`Readiness at ${biometrics.readiness} — reduce volume by 25%. Prioritize mobility.`}
              {biometrics.readiness<45&&`Critical recovery needed. Active recovery only. No high-intensity training today.`}
            </div>
          ):(
            <div className="ai-msg" style={{color:"var(--text2)"}}>Sync your wearable to receive personalized AI coaching recommendations.</div>
          )}
        </div>
      </div>

      {/* Injury Knowledge Hub */}
      <div className="card flat" style={{marginBottom:14}}>
        <div className="sec-title" style={{marginBottom:14}}>INJURY KNOWLEDGE HUB</div>
        <div className="tabs">
          {["common","rare","serious"].map(t=><div key={t} className={`tab${injTab===t?" active":""}`} onClick={()=>setInjTab(t)}>{t.toUpperCase()}</div>)}
        </div>
        <div className="g3">
          {(INJURIES_DB[injTab]||[]).map((inj,i)=>(
            <div key={i} className="injury-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>{inj.name}</div>
                <span style={{fontFamily:"'IBM Plex Mono'",fontSize:10,fontWeight:700,color:inj.severity==="Severe"?"var(--red)":inj.severity==="High"?"var(--accent)":"var(--amber)"}}>{inj.severity}</span>
              </div>
              <div style={{fontSize:12,color:"var(--text2)",marginTop:5,lineHeight:1.5}}>{inj.desc}</div>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text3)",marginTop:8}}>Recovery: {inj.recovery}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Device Sync */}
      <div className="card flat">
        <div className="sec-title" style={{marginBottom:14}}>DEVICE SYNC CENTER</div>
        {[{name:"Apple Watch",ico:"watch"},{name:"Polar H10",ico:"heartPulse"},{name:"Google Fit",ico:"activity"}].map((d,i)=>(
          <div key={i} className="device-row">
            <div className="device-ico"><Icon name={d.ico} size={18} color="var(--text2)" /></div>
            <div>
              <div style={{fontSize:14,fontWeight:500,color:"var(--text1)"}}>{d.name}</div>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text3)",marginTop:2}}>Not connected — go to Devices tab</div>
            </div>
            <StatusDot status="offline" size={7} />
          </div>
        ))}
      </div>
    </div>
  );
}
function InjuriesPage(){
  const[tab,setTab]=useState("common");
  const[q,setQ]=useState("");
  const all=[...INJURIES_DB.common,...INJURIES_DB.rare,...INJURIES_DB.serious];
  const filtered=(tab==="all"?all:INJURIES_DB[tab]||[]).filter(i=>i.name.toLowerCase().includes(q.toLowerCase()));
  const SC={Low:"chip chip-green",Moderate:"chip chip-yellow",High:"chip chip-orange",Severe:"chip chip-red"};
  return(
    <div>
      <div className="topbar"><div><h1>INJURY INTELLIGENCE</h1><div className="topbar-meta">PREVENTION LIBRARY Â· RECOVERY PROTOCOLS</div></div></div>
      <input className="input-field" placeholder="Search injuries…" value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:18}}/>
      <div className="tabs">
        {["common","rare","serious"].map(t=><div key={t} className={`tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {filtered.length>0?(
        <div className="g2">
          {filtered.map((inj,i)=>(
            <div key={i} className="card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:1}}>{inj.name}</div>
                <span className={SC[inj.severity]||"chip chip-gray"}>{inj.severity}</span>
              </div>
              <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.6,marginBottom:10}}>{inj.desc}</div>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)",marginBottom:12}}>Recovery: {inj.recovery}</div>
              <div className="divider" style={{margin:"10px 0"}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>Symptoms</div>
                  {inj.symptoms.map(s=><div key={s} style={{fontSize:12,color:"var(--text2)",display:"flex",gap:5,marginBottom:4}}><span style={{color:"#F97316",flexShrink:0}}>Â·</span>{s}</div>)}
                </div>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>Prevention</div>
                  {inj.prevention.map(p=><div key={p} style={{fontSize:12,color:"var(--text2)",display:"flex",gap:5,marginBottom:4}}><span style={{color:"#22C55E",flexShrink:0}}>Â·</span>{p}</div>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ):(
        <div className="card flat"><Empty icon="search" title="NO RESULTS" desc={q?`No injuries matching "${q}" found.`:"No injuries in this category."}/></div>
      )}
    </div>
  );
}

function DailyStatusPage({legionInfo,onSubmit}){
  const[vals,setVals]=useState({mood:70,energy:65,stress:30,sleepQuality:80});
  const[note,setNote]=useState("");
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  if(!legionInfo){
    return(
      <div>
        <div className="topbar"><div><h1>DAILY STATUS</h1></div></div>
        <div className="card flat"><Empty icon="lock" title="JOIN A LEGION FIRST" desc="Daily status reporting requires Legion membership. Ask your coach for an invite code." action={<span style={{fontSize:13,color:"var(--text2)"}}>Go to the Legion tab to join</span>}/></div>
      </div>
    );
  }
  const submit=async()=>{
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    onSubmit&&onSubmit({...vals,note,timestamp:Date.now()});
    setLoading(false);setDone(true);setTimeout(()=>setDone(false),3000);
  };
  return(
    <div style={{maxWidth:560}}>
      <div className="topbar">
        <div><h1>DAILY STATUS</h1><div className="topbar-meta">REAL-TIME SYNC TO COACH DASHBOARD</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <StatusDot status="active" size={7} />
          <span style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)"}}>LIVE SYNC</span>
        </div>
      </div>
      {done&&<div className="alert-banner alert-green"><div className="alert-dot"/><div><div className="alert-title">STATUS SUBMITTED</div><div className="alert-desc">Your coach has been notified Â· synced at {nowTime()}</div></div></div>}
      {[{k:"mood",l:"Mood",lo:"Low",hi:"High"},{k:"energy",l:"Energy Level",lo:"Drained",hi:"Energized"},{k:"stress",l:"Stress Level",lo:"Calm",hi:"High Stress"},{k:"sleepQuality",l:"Sleep Quality",lo:"Poor",hi:"Excellent"}].map(({k,l,lo,hi})=>(
        <div className="card flat" key={k} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
            <div className="card-lbl" style={{marginBottom:0}}>{l}</div>
            <div style={{fontFamily:"'IBM Plex Mono'",fontSize:14,fontWeight:700}}>{vals[k]}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)",marginBottom:3}}><span>{lo}</span><span>{hi}</span></div>
          <input type="range" min={0} max={100} value={vals[k]} className="status-slider"
            style={{background:`linear-gradient(to right,#111 ${vals[k]}%,var(--bg3) ${vals[k]}%)`}}
            onChange={e=>setVals(p=>({...p,[k]:+e.target.value}))}/>
        </div>
      ))}
      <div className="card flat" style={{marginBottom:18}}>
        <div className="card-lbl">Note to Coach (optional)</div>
        <textarea className="input-field" rows={3} placeholder="Share anything with your coach…" value={note} onChange={e=>setNote(e.target.value)} style={{marginTop:8,resize:"none"}}/>
      </div>
      <button className="btn btn-primary btn-full btn-lg" onClick={submit} disabled={loading}>
        {loading?<><Spin/>{" "}Submitting…</>:"Submit Daily Status"}
      </button>
    </div>
  );
}

function LegionAthletePage({profile,legionInfo,setLegionInfo}){
  const[code,setCode]=useState("");
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const join=async()=>{
    if(code.length!==6){setErr("Code must be exactly 6 characters.");return;}
    setLoading(true);setErr("");
    try {
      const legionsSnap = await get(ref(db, 'legions'));
      if (!legionsSnap.exists()) {
        throw new Error("No active legions exist.");
      }
      const legions = legionsSnap.val();
      const found = Object.values(legions).find((l) => l.inviteCode === code.toUpperCase());
      if (!found) {
        throw new Error("No Legion found with that invite code.");
      }
      await update(ref(db, `legions/${found.id}/athleteUids`), { [profile.id]: true });
      await update(ref(db, `users/${profile.id}`), { legionId: found.id, legionCode: code.toUpperCase() });
      setLegionInfo({
        id: found.id,
        name: found.name,
        code: code.toUpperCase(),
        sport: found.sport,
        coachName: "Coach",
        members: Object.keys(found.athleteUids || {}).length + 1
      });
    } catch (e) {
      setErr(e.message || "Failed to join legion.");
    } finally {
      setLoading(false);
    }
  };
  if(legionInfo){
    return(
      <div>
        <div className="topbar"><div><h1>MY LEGION</h1><div className="topbar-meta">ACTIVE MEMBERSHIP</div></div></div>
        <div className="card flat" style={{maxWidth:480,background:"var(--bg2)",border:"2px solid var(--accent)"}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{width:56,height:56,background:"var(--text1)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"var(--accent)"}}><Icon name="legion" size={24} /></div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{legionInfo.name}</div>
              <div style={{fontFamily:"'IBM Plex Mono'",fontSize:12,color:"var(--text2)",marginTop:4}}>{legionInfo.sport} Â· {legionInfo.coachName}</div>
              <div style={{display:"flex",gap:8,marginTop:10}}><span className="chip chip-green">ACTIVE</span><span style={{fontFamily:"'IBM Plex Mono'",fontSize:10,color:"var(--text3)",alignSelf:"center"}}>Code: {legionInfo.code}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return(
    <div style={{maxWidth:480}}>
      <div className="topbar"><div><h1>JOIN LEGION</h1></div></div>
      <div className="card flat">
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,background:"var(--bg3)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:"1px solid var(--border)"}}><Icon name="legion" size={28} color="var(--text2)" /></div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:3}}>ENTER INVITE CODE</div>
          <div style={{fontSize:13,color:"var(--text2)",marginTop:6}}>Get your 6-character code from your coach</div>
        </div>
        {err&&<div className="auth-error">{err}</div>}
        <div className="input-wrap">
          <label className="input-lbl">Legion Code</label>
          <input className="input-field" maxLength={6} placeholder="AB12CD" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
            style={{textAlign:"center",fontSize:28,fontFamily:"'Bebas Neue'",letterSpacing:8}}/>
        </div>
        <button className="btn btn-primary btn-full btn-lg" onClick={join} disabled={loading||code.length!==6}>
          {loading?<><Spin/>{" "}Joining…</>:"Join Legion →"}
        </button>
      </div>
    </div>
  );
}


function CoachDashboard({legion,athletes}){
  const[sel,setSel]=useState(null);
  const hasA=athletes&&athletes.length>0;
  return(
    <div>
      <div className="topbar">
        <div><h1>LEGION READINESS</h1><div className="topbar-meta">{legion?`${legion.name} Â· ${athletes?.length||0} athletes`:"No Legion created"} Â· REAL-TIME</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <StatusDot status="active" size={7} />
          <span style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)"}}>LIVE</span>
        </div>
      </div>
      <div className="g3">
        {[
          {lbl:"Average Readiness",val:hasA?Math.round(athletes.reduce((s,a)=>s+(a.readiness||0),0)/athletes.length):"—",sub:"team-wide score"},
          {lbl:"Athletes Ready",val:hasA?athletes.filter(a=>(a.readiness||0)>=65).length:"—",sub:`of ${athletes?.length||0} total`},
          {lbl:"Critical",val:hasA?athletes.filter(a=>(a.readiness||0)<45).length:"—",sub:"need immediate attention",red:hasA&&athletes.filter(a=>(a.readiness||0)<45).length>0},
        ].map((s,i)=>(
          <div key={i} className="card flat">
            <div className="card-lbl">{s.lbl}</div>
            <div className="card-val" style={{fontSize:44,color:s.red?"var(--red)":undefined}}>{s.val}</div>
            <div className="card-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      {!hasA?(
        <div className="card flat"><Empty icon="users" title="NO ATHLETES YET" desc="Share your Legion invite code with athletes. Their readiness data will appear here in real time as they join and submit daily status."/></div>
      ):(
        <>
          <div className="sec-hdr" style={{marginTop:8}}><div className="sec-title">ATHLETE ROSTER</div><span className="sec-action">Sorted by readiness â†‘</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[...athletes].sort((a,b)=>(a.readiness||100)-(b.readiness||100)).map(a=>(
              <div key={a.id} className="card" style={{cursor:"pointer",borderTop:(a.readiness||100)<45?"3px solid var(--red)":undefined}} onClick={()=>setSel(a)}>
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"var(--text1)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue'",fontSize:17,color:"var(--accent)",flexShrink:0}}>{inits(a.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{a.name}</div>
                    <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)"}}>{a.sport}</div>
                  </div>
                  <Ring score={a.readiness} size={46}/>
                </div>
                <div style={{display:"flex",gap:12}}>
                  {[["HRV",a.hrv?`${a.hrv}ms`:"—"],["RHR",a.rhr?`${a.rhr}`:"—"],["Sleep",a.sleep?`${a.sleep}h`:"—"]].map(([k,v])=>(
                    <div key={k} style={{flex:1}}>
                      <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1}}>{k}</div>
                      <div style={{fontFamily:"'IBM Plex Mono'",fontSize:12,fontWeight:700,marginTop:2}}>{v}</div>
                    </div>
                  ))}
                </div>
                {a.status&&(
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:10}}>
                    <span className={moodCls(a.status.mood)}>{a.status.mood}</span>
                    <span className={moodCls(a.status.energy)}>{a.status.energy}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {sel&&(
        <div className="panel-overlay" onClick={()=>setSel(null)}>
          <div className="panel" onClick={e=>e.stopPropagation()}>
            <span className="panel-close" onClick={()=>setSel(null)}><Icon name="x" size={16} /></span>
            <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:24,paddingTop:4}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:"var(--text1)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue'",fontSize:22,color:"var(--accent)",flexShrink:0}}>{inits(sel.name)}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{sel.name}</div>
                <div style={{fontFamily:"'IBM Plex Mono'",fontSize:12,color:"var(--text2)"}}>{sel.sport}</div>
              </div>
              <Ring score={sel.readiness} size={80}/>
            </div>
            <div className="sec-title" style={{marginBottom:12}}>PERFORMANCE RADAR</div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <RadarChart data={{HRV:sel.hrv||0,Sleep:(sel.sleep||0)*10,Mood:sel.status?.mood==="High"?85:sel.status?.mood==="Low"?30:55,Energy:sel.status?.energy==="High"?85:sel.status?.energy==="Low"?30:55,Recovery:sel.readiness||0}} size={220}/>
            </div>
            <div className="sec-title" style={{marginBottom:12}}>BIOMETRICS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18}}>
              {[["HRV",sel.hrv?`${sel.hrv} ms`:"—"],["RHR",sel.rhr?`${sel.rhr} bpm`:"—"],["Sleep",sel.sleep?`${sel.sleep} hrs`:"—"]].map(([k,v])=>(
                <div key={k} style={{background:"var(--bg2)",borderRadius:10,padding:12,border:"1px solid var(--border)",textAlign:"center"}}>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1}}>{k}</div>
                  <div style={{fontFamily:"'IBM Plex Mono'",fontSize:15,fontWeight:700,marginTop:5}}>{v}</div>
                </div>
              ))}
            </div>
            {sel.status?(
              <>
                <div className="sec-title" style={{marginBottom:12}}>DAILY STATUS</div>
                {[["Mood",sel.status.mood],["Energy",sel.status.energy],["Stress",sel.status.stress]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:10,padding:"10px 14px",background:"var(--bg2)",borderRadius:10,border:"1px solid var(--border)"}}>
                    <span style={{fontFamily:"'IBM Plex Mono'",fontSize:12,color:"var(--text2)"}}>{k}</span>
                    <span className={moodCls(v)}>{v}</span>
                  </div>
                ))}
                {sel.status.note&&<div style={{marginTop:8,padding:"12px 14px",background:"var(--amber-bg)",border:"1px solid var(--amber-border)",borderRadius:10,fontSize:13,lineHeight:1.5}}>"{sel.status.note}"</div>}
              </>
            ):(
              <div style={{textAlign:"center",padding:"20px 0",color:"var(--text3)",fontFamily:"'IBM Plex Mono'",fontSize:12}}>No daily status submitted yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LegionCoachPage({legion,setLegion,athletes,profile}){
  const[copied,setCopied]=useState(false);
  const[form,setForm]=useState({name:"",sport:SPORTS[0]});
  const[loading,setLoading]=useState(false);
  const create=async()=>{
    if(!form.name.trim())return;
    setLoading(true);
    try {
      const code = Math.random().toString(36).substring(2,8).toUpperCase();
      const newLegionRef = push(ref(db, 'legions'));
      const legionId = newLegionRef.key;
      const newLegion = {
        id: legionId,
        name: form.name.trim(),
        coachUid: profile.id,
        inviteCode: code,
        sport: form.sport,
        createdAt: Date.now(),
        athleteUids: {}
      };
      await set(newLegionRef, newLegion);
      await update(ref(db, `users/${profile.id}`), { legionId, legionCode: code });
      setLegion({ ...form, code, id: legionId });
    } catch (err) {
      console.error("Error creating legion in DB:", err);
      const code=Math.random().toString(36).substring(2,8).toUpperCase();
      setLegion({...form,code});
    }
    setLoading(false);
  };
  const copy=()=>{navigator.clipboard?.writeText(legion?.code||"");setCopied(true);setTimeout(()=>setCopied(false),2000);};
  if(!legion){
    return(
      <div style={{maxWidth:480}}>
        <div className="topbar"><div><h1>CREATE LEGION</h1></div></div>
        <div className="card flat">
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{width:56,height:56,background:"var(--bg3)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:"1px solid var(--border)"}}><Icon name="legion" size={28} color="var(--text2)" /></div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:3}}>BUILD YOUR TEAM</div>
            <div style={{fontSize:13,color:"var(--text2)",marginTop:6}}>Create a Legion to start monitoring your athletes in real time</div>
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Legion Name</label>
            <input className="input-field" placeholder="Thunder Athletics" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Primary Sport</label>
            <select className="input-field" value={form.sport} onChange={e=>setForm(p=>({...p,sport:e.target.value}))}>
              {SPORTS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={create} disabled={loading||!form.name.trim()}>
            {loading?<><Spin/>{" "}Creating…</>:"Create Legion →"}
          </button>
        </div>
      </div>
    );
  }
  return(
    <div>
      <div className="topbar"><div><h1>LEGION</h1><div className="topbar-meta">{legion.name} Â· ROSTER MANAGEMENT</div></div></div>
      <div className="g23" style={{marginBottom:18}}>
        <div style={{background:"var(--surface)",border:"2px solid var(--accent)",borderRadius:20,textAlign:"center",padding:32}}>
          <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>Athlete Invite Code</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:52,letterSpacing:10,color:"var(--text1)",padding:16}}>{legion.code}</div>
          <button className="btn btn-primary" style={{margin:"0 auto",display:"flex"}} onClick={copy}>{copied ? "Copied" : "Copy Code"}</button>
          <div style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text3)",marginTop:12}}>Share with athletes to join {legion.name}</div>
        </div>
        <div className="card flat">
          <div className="sec-title" style={{marginBottom:16}}>LEGION OVERVIEW</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["Name",legion.name],["Sport",legion.sport],["Athletes",athletes?.length||0],["Invite Code",legion.code]].map(([k,v])=>(
              <div key={k} style={{background:"var(--bg2)",borderRadius:10,padding:14,border:"1px solid var(--border)"}}>
                <div style={{fontFamily:"'IBM Plex Mono'",fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{k}</div>
                <div style={{fontSize:14,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card flat">
        <div className="sec-title" style={{marginBottom:16}}>ROSTER</div>
        {athletes&&athletes.length>0?(
          <table className="data-table">
            <thead><tr>{["Athlete","Sport","Readiness","HRV","RHR","Sleep","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {athletes.map(a=>{const t=getTier(a.readiness||0);return(
                <tr key={a.id}>
                  <td style={{fontWeight:600}}>{a.name}</td>
                  <td style={{fontFamily:"'IBM Plex Mono'",fontSize:11,color:"var(--text2)"}}>{a.sport}</td>
                  <td><span className={t.cls}>{a.readiness||"—"}</span></td>
                  <td style={{fontFamily:"'IBM Plex Mono'",fontSize:12}}>{a.hrv||"—"}</td>
                  <td style={{fontFamily:"'IBM Plex Mono'",fontSize:12}}>{a.rhr||"—"}</td>
                  <td style={{fontFamily:"'IBM Plex Mono'",fontSize:12}}>{a.sleep?`${a.sleep}h`:"—"}</td>
                  <td>{a.status?<span className="chip chip-green">Submitted</span>:<span className="chip chip-gray">Pending</span>}</td>
                </tr>
              );})}
            </tbody>
          </table>
        ):(
          <Empty icon="users" title="NO ATHLETES YET" desc="Athletes who join using your invite code will appear here automatically."/>
        )}
      </div>
    </div>
  );
}

function AthletesDeepDive({athletes}){
  const[sel,setSel]=useState(athletes?.[0]||null);
  if(!athletes||athletes.length===0){
    return(
      <div>
        <div className="topbar"><div><h1>ATHLETES</h1><div className="topbar-meta">DEEP DIVE ANALYTICS</div></div></div>
        <div className="card flat"><Empty icon="barChart" title="NO ATHLETES YET" desc="Athletes will appear here once they join your Legion and submit data."/></div>
      </div>
    );
  }
  return(
    <div>
      <div className="topbar"><div><h1>ATHLETES</h1><div className="topbar-meta">DEEP DIVE ANALYTICS</div></div></div>
      <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
        {athletes.map(a=>(
          <div key={a.id} onClick={()=>setSel(a)} style={{cursor:"pointer",padding:"8px 14px",borderRadius:10,border:`1px solid ${sel?.id===a.id?"var(--text1)":"var(--border)"}`,background:sel?.id===a.id?"#111":"var(--surface)",display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:sel?.id===a.id?"var(--accent)":"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:sel?.id===a.id?"#111":"var(--text2)"}}>{inits(a.name)}</div>
            <span style={{fontSize:13,fontWeight:500,color:sel?.id===a.id?"#fff":"var(--text1)"}}>{a.name}</span>
          </div>
        ))}
      </div>
      {sel&&(
        <>
          <div className="card flat" style={{marginBottom:14,background:"var(--bg2)",border:"1px solid var(--border)"}}>
            <div style={{display:"flex",gap:20,alignItems:"center"}}>
              <div style={{width:72,height:72,borderRadius:18,background:"var(--text1)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue'",fontSize:26,color:"var(--accent)",flexShrink:0}}>{inits(sel.name)}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2}}>{sel.name}</div>
                <div style={{fontFamily:"'IBM Plex Mono'",fontSize:12,color:"var(--text2)",marginTop:3}}>{sel.sport}</div>
                <div style={{marginTop:10}}><span className={getTier(sel.readiness||0).cls}>{getTier(sel.readiness||0).label}</span></div>
              </div>
              <Ring score={sel.readiness} size={90}/>
            </div>
          </div>
          <div className="g2">
            <div className="card flat">
              <div className="sec-title" style={{marginBottom:12}}>READINESS HISTORY</div>
              {sel.history?.length>0?(
                <div style={{display:"flex",alignItems:"flex-end",gap:5,height:80}}>
                  {sel.history.map((v,i)=>{const t=getTier(v);return(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{width:"100%",background:t.color,borderRadius:"3px 3px 0 0",height:`${v*0.78}%`,maxHeight:66,minHeight:4}}/>
                      <span style={{fontFamily:"'IBM Plex Mono'",fontSize:8,color:"var(--text3)"}}>{i+1}</span>
                    </div>
                  );})}
                </div>
              ):(
                <Empty icon="barChart" title="NO HISTORY" desc="Readiness history will appear here."/>
              )}
            </div>
            <div className="card flat">
              <div className="sec-title" style={{marginBottom:12}}>PERFORMANCE RADAR</div>
              <div style={{display:"flex",justifyContent:"center"}}>
                <RadarChart data={{HRV:sel.hrv||0,Sleep:(sel.sleep||0)*10,Mood:sel.status?.mood==="High"?85:40,Energy:sel.status?.energy==="High"?85:40,Recovery:sel.readiness||0}} size={200}/>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}



/* ─────────────────────────────────────────────
   PERSISTENCE — localStorage-backed state
───────────────────────────────────────────── */


/* ─────────────────────────────────────────────
   VALIDATION HELPERS
───────────────────────────────────────────── */
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validatePassword(p) { return p.length >= 8; }
function validateName(n) { return n.trim().length >= 2; }



/* ─────────────────────────────────────────────
   CHANGE EMAIL MODAL
───────────────────────────────────────────── */
function ChangeEmailModal({ current, onSave, onClose }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!validateEmail(email)) { setErr("Enter a valid email address."); return; }
    if (!pw) { setErr("Enter your current password to confirm."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    onSave(email);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Change Email</div>
        <div className="modal-desc">Current: <strong>{current}</strong></div>
        {err && <div className="auth-error">{err}</div>}
        <div className="input-wrap">
          <label className="input-lbl">New Email Address</label>
          <input className="input-field" type="email" placeholder="new@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-wrap" style={{ marginBottom: 20 }}>
          <label className="input-lbl">Current Password</label>
          <input className="input-field" type="password" placeholder="Confirm with your password" value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <><Spin />{" "}Saving…</> : "Update Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHANGE PASSWORD MODAL
───────────────────────────────────────────── */
function ChangePasswordModal({ onSave, onClose }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!form.current) { setErr("Enter your current password."); return; }
    if (!validatePassword(form.next)) { setErr("New password must be at least 8 characters."); return; }
    if (form.next !== form.confirm) { setErr("Passwords do not match."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Change Password</div>
        <div className="modal-desc">Choose a strong password of at least 8 characters.</div>
        {err && <div className="auth-error">{err}</div>}
        {[["current", "Current Password"], ["next", "New Password"], ["confirm", "Confirm New Password"]].map(([k, l]) => (
          <div className="input-wrap" key={k}>
            <label className="input-lbl">{l}</label>
            <input className="input-field" type="password" placeholder="••••••••" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
        <div className="modal-actions" style={{ marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <><Spin />{" "}Updating…</> : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PROFILE PAGE — fully functional
───────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   SERVICE LAYER — abstractions that swap for real APIs
═══════════════════════════════════════════════════════════ */

// ── Storage Service ──────────────────────────────────────
const StorageService = {
  get: (key) => { try { const v = localStorage.getItem("rv_" + key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem("rv_" + key, JSON.stringify(val)); return true; } catch { return false; } },
  remove: (key) => { try { localStorage.removeItem("rv_" + key); } catch {} },
  clear: (prefix = "") => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("rv_" + prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },
};

// ── Auth Service ─────────────────────────────────────────
const AuthService = {
  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const u = cred.user;
    return {
      id: u.uid,
      uid: u.uid,
      name: u.displayName || u.email.split("@")[0],
      email: u.email,
      avatar: u.photoURL,
      provider: "google",
      createdAt: Date.now()
    };
  },
 
  signOut: async () => {
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    await firebaseSignOut(auth);
  },
 
  getStoredUser: () => {
    const u = auth.currentUser;
    if (!u) return null;
    return {
      id: u.uid,
      uid: u.uid,
      name: u.displayName || u.email.split("@")[0],
      email: u.email,
      avatar: u.photoURL,
      provider: u.providerData[0]?.providerId || "email",
      createdAt: Date.now()
    };
  },
 
  signInWithEmail: async (email, password) => {
    if (!email || !password) throw new Error("Email and password required.");
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const u = cred.user;
    return {
      id: u.uid,
      uid: u.uid,
      name: u.displayName || u.email.split("@")[0],
      email: u.email,
      avatar: u.photoURL,
      provider: "email",
      createdAt: Date.now()
    };
  },
 
  signUpWithEmail: async (name, email, password) => {
    if (!name?.trim() || name.trim().length < 2) throw new Error("Full name must be at least 2 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const u = cred.user;
    const profile = {
      id: u.uid,
      uid: u.uid,
      name: name.trim(),
      email: u.email,
      role: "coach",
      sport: "",
      streak: 0,
      createdAt: Date.now()
    };
    await set(ref(db, `users/${u.uid}`), profile);
    return {
      id: u.uid,
      uid: u.uid,
      name: name.trim(),
      email: u.email,
      avatar: null,
      provider: "email",
      createdAt: Date.now()
    };
  },

  updatePassword: async (currentPw, newPw, confirmPw) => {
    if (!currentPw) throw new Error("Enter your current password.");
    if (newPw.length < 8) throw new Error("New password must be at least 8 characters.");
    if (newPw !== confirmPw) throw new Error("Passwords do not match.");
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (!user.email) throw new Error("No email on this account. Cannot re-authenticate.");
    const credential = EmailAuthProvider.credential(user.email, currentPw);
    await reauthenticateWithCredential(user, credential);
    await fbUpdatePassword(user, newPw);
    return true;
  },

  updateEmail: async (newEmail, currentPw) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error("Invalid email address.");
    if (!currentPw) throw new Error("Current password required to change email.");
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    if (!user.email) throw new Error("No email on this account.");
    const credential = EmailAuthProvider.credential(user.email, currentPw);
    await reauthenticateWithCredential(user, credential);
    await verifyBeforeUpdateEmail(user, newEmail);
    return true;
  },
};

// ── Profile Service ───────────────────────────────────────
const ProfileService = {
  load: async (userId) => {
    const snap = await get(ref(db, `users/${userId}`));
    return snap.exists() ? snap.val() : null;
  },

  save: async (userId, data) => {
    // Sanitize text inputs
    if (data.name) data.name = clampStr(data.name, MAX_NAME_LEN);
    if (data.team) data.team = clampStr(data.team, MAX_NAME_LEN);
    if (data.notes) data.notes = clampStr(data.notes, MAX_NOTES_LEN);
    if (!data.name?.trim() || data.name.trim().length < 2) throw new Error("Name must be at least 2 characters.");
    if (data.weight && (parseFloat(data.weight) < 20 || parseFloat(data.weight) > 400)) throw new Error("Enter a valid weight (20–400 kg).");
    if (data.height && (parseInt(data.height) < 100 || parseInt(data.height) > 250)) throw new Error("Enter a valid height (100–250 cm).");
    if (data.age && (parseInt(data.age) < 10 || parseInt(data.age) > 100)) throw new Error("Enter a valid age (10–100).");
    const snap = await get(ref(db, `users/${userId}/createdAt`));
    const createdAt = snap.exists() ? snap.val() : Date.now();
    const profile = { ...data, id: userId, uid: userId, createdAt, updatedAt: Date.now() };
    await set(ref(db, `users/${userId}`), profile);
    return profile;
  },

  uploadAvatar: async (userId, file) => {
    if (!file) throw new Error("No file selected.");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) throw new Error("Only JPEG, PNG, WebP or GIF images allowed.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        StorageService.set("avatar_" + userId, e.target.result);
        resolve(e.target.result);
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  },

  removeAvatar: async (userId) => {
    StorageService.remove("avatar_" + userId);
  },

  getAvatar: (userId) => StorageService.get("avatar_" + userId),

  submitFeedback: async (userId, { type, subject, message }) => {
    if (!subject?.trim()) throw new Error("Subject is required.");
    if (!message?.trim() || message.trim().length < 10) throw new Error("Message must be at least 10 characters.");
    const cleanSubject = clampStr(subject, MAX_NAME_LEN);
    const cleanMessage = clampStr(message, MAX_FEEDBACK_LEN);
    const newRef = push(ref(db, `feedback/${userId}`));
    const ticket = { id: newRef.key, type: sanitize(type), subject: cleanSubject, message: cleanMessage, userId, submittedAt: Date.now() };
    await set(newRef, ticket);
    return ticket;
  },

  deleteAccount: async (userId, confirmText) => {
    if (confirmText !== "DELETE") throw new Error("Type DELETE to confirm account deletion.");
    // Delete all user data from Firebase RTDB
    await Promise.all([
      remove(ref(db, `users/${userId}`)),
      remove(ref(db, `workouts/${userId}`)),
      remove(ref(db, `recovery/${userId}`)),
      remove(ref(db, `daily_status/${userId}`)),
      remove(ref(db, `injuries/${userId}`)),
      remove(ref(db, `feedback/${userId}`)),
    ]);
    // Clean up localStorage
    StorageService.clear("profile_" + userId);
    StorageService.clear("avatar_" + userId);
    StorageService.clear("devices_" + userId);
    StorageService.clear("settings_" + userId);
    // Delete Firebase Auth user and sign out
    const user = auth.currentUser;
    if (user) {
      try { await fbDeleteUser(user); } catch { /* may require re-auth */ }
    }
    await AuthService.signOut();
    return true;
  },
};

// ── Settings Service ──────────────────────────────────────
const SettingsService = {
  DEFAULTS: {
    notifications: { readiness: true, coachAlerts: true, weeklyReport: true, injuryWarnings: true, sessionReminder: false, deviceSync: true },
    privacy: { shareReadiness: true, shareBiometrics: true, shareWorkouts: false, analytics: true },
    theme: "light",
    language: "en",
    units: { weight: "kg", distance: "km", temp: "celsius" },
  },

  load: async (userId) => {
    // Try Firebase first, fall back to localStorage
    try {
      const snap = await get(ref(db, `users/${userId}/settings`));
      if (snap.exists()) {
        const fbSettings = snap.val();
        StorageService.set("settings_" + userId, fbSettings);
        return { ...SettingsService.DEFAULTS, ...fbSettings };
      }
    } catch { /* offline fallback */ }
    const stored = StorageService.get("settings_" + userId);
    return stored ? { ...SettingsService.DEFAULTS, ...stored } : { ...SettingsService.DEFAULTS };
  },

  save: async (userId, settings) => {
    StorageService.set("settings_" + userId, settings);
    await update(ref(db, `users/${userId}`), { settings });
    return settings;
  },
};

// ── Device Service ────────────────────────────────────────
const DeviceService = {
  SUPPORTED: [
    { id: "apple_watch", name: "Apple Watch", brand: "Apple", icon: "watch", type: "healthkit",
      description: "Sync heart rate, HRV, sleep, workouts and activity via Apple Health.",
      metrics: ["Heart Rate", "HRV", "Resting HR", "Sleep", "Steps", "Workouts", "Calories"],
      requiresBluetooth: false, requiresHealth: true },
    { id: "polar_h10", name: "Polar H10", brand: "Polar", icon: "heartPulse", type: "bluetooth",
      description: "Chest strap with real-time ECG-accurate heart rate via Bluetooth.",
      metrics: ["Heart Rate (Live)", "RR Intervals", "ECG"],
      requiresBluetooth: true, requiresHealth: false },
    { id: "google_fit", name: "Google Fit", brand: "Google", icon: "activity", type: "healthconnect",
      description: "Sync fitness and health data via Google Health Connect on Android.",
      metrics: ["Heart Rate", "Steps", "Sleep", "Calories", "Workouts"],
      requiresBluetooth: false, requiresHealth: true },
  ],

  loadAll: (userId) => StorageService.get("devices_" + userId) || {},

  save: (userId, devices) => {
    StorageService.set("devices_" + userId, devices);
    // Persist to Firebase (non-blocking)
    update(ref(db, `users/${userId}`), { devices }).catch(() => {});
  },

  // Apple HealthKit connection
  connectAppleWatch: async () => {
    if (window.webkit?.messageHandlers?.healthkit) {
      return new Promise((resolve, reject) => {
        window.healthkitCallback = (result) => { delete window.healthkitCallback; resolve(result); };
        window.healthkitErrorCallback = (err) => { delete window.healthkitErrorCallback; reject(new Error(err)); };
        window.webkit.messageHandlers.healthkit.postMessage({
          action: "requestPermissions",
          readTypes: ["HKQuantityTypeIdentifierHeartRate", "HKQuantityTypeIdentifierRestingHeartRate",
            "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "HKCategoryTypeIdentifierSleepAnalysis",
            "HKQuantityTypeIdentifierActiveEnergyBurned", "HKQuantityTypeIdentifierStepCount",
            "HKWorkoutTypeIdentifier", "HKQuantityTypeIdentifierBodyMass"],
        });
      });
    }
    // Web fallback: check navigator.health (future standard)
    if (navigator.health) {
      const types = ["heart_rate", "resting_heart_rate", "hrv", "sleep", "steps", "calories"];
      await navigator.health.requestPermission(types.map(t => ({ name: t, access: "read" })));
      return { deviceId: "apple_watch_" + Date.now(), deviceName: "Apple Watch", grantedAt: Date.now() };
    }
    throw new Error("Apple Health is not available on this platform. Use the Recovo mobile app to connect your Apple Watch.");
  },

  syncAppleWatch: async () => {
    if (window.webkit?.messageHandlers?.healthkit) {
      return new Promise((resolve, reject) => {
        window.healthkitDataCallback = (data) => { delete window.healthkitDataCallback; resolve(data); };
        window.healthkitErrorCallback = (err) => { delete window.healthkitErrorCallback; reject(new Error(err)); };
        window.webkit.messageHandlers.healthkit.postMessage({ action: "readLatest" });
      });
    }
    if (navigator.health) {
      try {
        const start = new Date(Date.now() - 86400000), end = new Date();
        const results = await Promise.allSettled([
          navigator.health.query({ name: "heart_rate", startDate: start, endDate: end }),
          navigator.health.query({ name: "resting_heart_rate", startDate: start, endDate: end }),
          navigator.health.query({ name: "hrv", startDate: start, endDate: end }),
          navigator.health.query({ name: "sleep", startDate: start, endDate: end }),
          navigator.health.query({ name: "steps", startDate: start, endDate: end }),
          navigator.health.query({ name: "calories", startDate: start, endDate: end }),
        ]);
        const [hr, rhr, hrv, sleep, steps, cal] = results.map(r => r.status === "fulfilled" ? r.value?.at(-1)?.value : null);
        return { heart_rate: hr, resting_heart_rate: rhr, hrv, sleep, steps, calories: cal };
      } catch {}
    }
    throw new Error("No health data source available. Connect a device through the Recovo mobile app.");
  },

  // Google Health Connect
  connectGoogleFit: async () => {
    if (window.HealthConnect) {
      const status = await window.HealthConnect.sdkStatus().catch(() => null);
      if (status !== "INSTALLED") throw new Error("Install Health Connect from the Play Store first.");
      const granted = await window.HealthConnect.requestPermissions(["READ_HEART_RATE","READ_RESTING_HEART_RATE","READ_SLEEP","READ_STEPS","READ_TOTAL_CALORIES_BURNED","READ_EXERCISE"]);
      if (!granted) throw new Error("Health Connect permissions denied.");
      return { deviceId: "google_fit_" + Date.now(), deviceName: "Google Fit", grantedAt: Date.now() };
    }
    throw new Error("Google Health Connect is not available on this platform. Use the Recovo mobile app on an Android device.");
  },

  syncGoogleFit: async () => {
    if (window.HealthConnect) {
      const now = new Date(), prev = new Date(Date.now() - 86400000);
      const tf = { type: "BETWEEN", startTime: prev.toISOString(), endTime: now.toISOString() };
      const [hr, rhr, sleep, steps, cal] = await Promise.allSettled([
        window.HealthConnect.readRecords("HeartRate", { timeRangeFilter: tf }),
        window.HealthConnect.readRecords("RestingHeartRate", { timeRangeFilter: tf }),
        window.HealthConnect.readRecords("SleepSession", { timeRangeFilter: tf }),
        window.HealthConnect.readRecords("Steps", { timeRangeFilter: tf }),
        window.HealthConnect.readRecords("TotalCaloriesBurned", { timeRangeFilter: tf }),
      ]).then(r => r.map(x => x.status === "fulfilled" ? x.value : null));
      return {
        heart_rate: hr?.records?.at(-1)?.samples?.at(-1)?.beatsPerMinute,
        resting_heart_rate: rhr?.records?.at(-1)?.beatsPerMinute,
        sleep: sleep?.records?.reduce((s, r) => s + (new Date(r.endTime) - new Date(r.startTime)) / 3600000, 0),
        steps: steps?.records?.reduce((s, r) => s + r.count, 0),
        calories: cal?.records?.reduce((s, r) => s + r.energy?.inKilocalories, 0),
        syncedAt: Date.now(),
      };
    }
    throw new Error("Google Health Connect is not available. Use the Recovo mobile app on an Android device.");
  },

  // Polar H10 via Web Bluetooth
  scanPolar: async () => {
    if (!navigator.bluetooth) throw new Error("BLUETOOTH_UNAVAILABLE");
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "Polar H10" }, { namePrefix: "Polar H9" }, { namePrefix: "Polar" }],
      optionalServices: ["heart_rate", "battery_service", "device_information"],
    });
    return device;
  },

  connectPolarBLE: async (device) => {
    const server = await device.gatt.connect();
    const hrService = await server.getPrimaryService("heart_rate");
    const hrChar = await hrService.getCharacteristic("heart_rate_measurement");
    let battery = null;
    try {
      const batSvc = await server.getPrimaryService("battery_service");
      const batChar = await batSvc.getCharacteristic("battery_level");
      battery = (await batChar.readValue()).getUint8(0);
    } catch {}
    return { server, hrChar, battery };
  },

  parseHRMeasurement: (value) => {
    const flags = value.getUint8(0);
    const hr = (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
    let rrIntervals = [];
    if (flags & 0x10) {
      const rrOffset = (flags & 0x1) ? 3 : 2;
      for (let i = rrOffset; i + 1 < value.byteLength; i += 2) {
        rrIntervals.push(value.getUint16(i, true) / 1024 * 1000);
      }
    }
    return { hr, rrIntervals };
  },

  computeReadiness: (metrics) => {
    const hrv = metrics.hrv || 0;
    const sleep = metrics.sleep || 0;
    const rhr = metrics.resting_heart_rate || 60;
    const hrvScore = Math.min(50, (hrv / 80) * 50);
    const sleepScore = Math.min(35, (sleep / 9) * 35);
    const rhrScore = Math.max(0, Math.min(15, ((80 - rhr) / 40) * 15));
    return Math.round(Math.min(100, Math.max(0, hrvScore + sleepScore + rhrScore)));
  },
};

/* ═══════════════════════════════════════════════════════════
   STATE HOOKS
═══════════════════════════════════════════════════════════ */

function usePersistedState(key, defaultVal) {
  const [val, setVal] = useState(() => {
    const stored = StorageService.get(key);
    return stored !== null ? stored : defaultVal;
  });
  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(val) : v;
    StorageService.set(key, next);
    setVal(next);
  }, [key, val]);
  return [val, set];
}

function useDevices(userId) {
  const [devices, setDevicesState] = useState(() => DeviceService.loadAll(userId));
  const setDevices = useCallback((updater) => {
    setDevicesState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      DeviceService.save(userId, next);
      return next;
    });
  }, [userId]);
  return [devices, setDevices];
}

function useSettings(userId) {
  const [settings, setSettingsState] = useState(() => {
    // Synchronous load from localStorage as initial value
    const stored = StorageService.get("settings_" + userId);
    return stored ? { ...SettingsService.DEFAULTS, ...stored } : { ...SettingsService.DEFAULTS };
  });

  // Async load from Firebase on mount
  useEffect(() => {
    SettingsService.load(userId).then(s => setSettingsState(s)).catch(() => {});
  }, [userId]);

  const updateSettings = useCallback(async (patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      SettingsService.save(userId, next);
      return next;
    });
  }, [userId]);
  const updateNested = useCallback(async (section, patch) => {
    setSettingsState(prev => {
      const next = { ...prev, [section]: { ...prev[section], ...patch } };
      SettingsService.save(userId, next);
      return next;
    });
  }, [userId]);
  return { settings, updateSettings, updateNested };
}

/* ═══════════════════════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════════════════════ */

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "success", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);
  const dismiss = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);
  const toastIcon = (type) => {
    if (type === "error") return <Icon name="x" size={14} color="var(--red)" />;
    if (type === "warn")  return <Icon name="warn" size={14} color="var(--amber)" />;
    return <Icon name="check" size={14} color="var(--green)" />;
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-container" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => dismiss(t.id)}
            className={`alert-banner ${t.type === "error" ? "alert-red" : t.type === "warn" ? "alert-orange" : "alert-green"}`}
            style={{ margin: 0, boxShadow: "var(--shadow-lg)", cursor: "pointer", animation: "fadeSlide 0.3s ease", alignItems: "center" }}>
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{toastIcon(t.type)}</span>
            <div style={{ fontSize: 13, fontWeight: 500, flex: 1, color: "var(--text1)" }}>{t.msg}</div>
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center", color: "var(--text3)", cursor: "pointer" }}>
              <Icon name="x" size={13} />
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() { return useContext(ToastContext); }

/* ═══════════════════════════════════════════════════════════
   SHARED UI ATOMS
═══════════════════════════════════════════════════════════ */

function Toggle({ checked, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#111" : "var(--bg4)", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: checked ? "var(--accent)" : "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange, disabled, type = "toggle", children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      {type === "toggle" && <Toggle checked={checked} onChange={onChange} disabled={disabled} />}
      {type === "custom" && children}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="sec-title">{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function ModalWrapper({ onClose, children, width = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ width, maxWidth: "92vw", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: 32, boxShadow: "0 24px 64px rgba(0,0,0,0.12)", animation: "scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function SkeletonBlock({ height = 20, width = "100%", radius = 8, style = {} }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}

/* ═══════════════════════════════════════════════════════════
   DEVICE SCANNING MODAL
═══════════════════════════════════════════════════════════ */

function DeviceScanModal({ deviceDef, onConnected, onClose }) {
  const toast = useToast();
  const [phase, setPhase] = useState("scanning"); // scanning | found | connecting | success | error
  const [foundDevices, setFoundDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [btDevice, setBtDevice] = useState(null);
  const btRef = useRef(null);

  useEffect(() => {
    if (deviceDef.type === "bluetooth") startBluetoothScan();
    else startHealthScan();
  }, []);

  const startBluetoothScan = async () => {
    setPhase("scanning");
    if (!navigator.bluetooth) {
      setErrorMsg("Bluetooth is not available in this browser. Please use Chrome or Edge on a supported device.");
      setPhase("error"); return;
    }
    try {
      const device = await DeviceService.scanPolar();
      setBtDevice(device);
      setFoundDevices([{ id: device.id, name: device.name || "Polar H10", rssi: -65 + Math.floor(Math.random() * 30) }]);
      setPhase("found");
    } catch (e) {
      if (e.name === "NotFoundError") { setErrorMsg("No Polar device found. Make sure it is turned on and in range."); }
      else if (e.name === "SecurityError") { setErrorMsg("Bluetooth permission denied. Allow Bluetooth access in your browser settings."); }
      else { setErrorMsg(e.message); }
      setPhase("error");
    }
  };

  const startHealthScan = async () => {
    setPhase("scanning");
    await new Promise(r => setTimeout(r, 1600));
    setFoundDevices([{ id: deviceDef.id + "_1", name: deviceDef.name, rssi: null }]);
    setPhase("found");
  };

  const connectDevice = async (device) => {
    setSelectedDevice(device);
    setPhase("connecting");
    try {
      let connectionData;
      if (deviceDef.type === "bluetooth" && btDevice) {
        const { server, hrChar, battery } = await DeviceService.connectPolarBLE(btDevice);
        btRef.current = { server, hrChar, device: btDevice };
        connectionData = { deviceId: btDevice.id, deviceName: btDevice.name, battery, connectedAt: Date.now() };
      } else if (deviceDef.id === "apple_watch") {
        connectionData = await DeviceService.connectAppleWatch();
      } else {
        connectionData = await DeviceService.connectGoogleFit();
      }
      setPhase("success");
      setTimeout(() => { onConnected({ ...connectionData, btRef: btRef.current }); onClose(); }, 800);
    } catch (e) {
      setErrorMsg(e.message === "BLUETOOTH_UNAVAILABLE" ? "Bluetooth is not available in this browser." : e.message);
      setPhase("error");
    }
  };

  const retry = () => {
    setErrorMsg(""); setFoundDevices([]); setSelectedDevice(null);
    if (deviceDef.type === "bluetooth") startBluetoothScan();
    else startHealthScan();
  };

  return (
    <ModalWrapper onClose={onClose} width={420}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width:72,height:72,background:"var(--bg3)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:"1px solid var(--border)" }}><Icon name=<Icon name={deviceDef.icon} size={20} color="#111" /> size={32} color="var(--text2)" /></div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, marginBottom: 6 }}>{deviceDef.name}</div>
        {phase === "scanning" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, position: "relative" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--accent)", animation: `pulse ${1.2 + i * 0.4}s ease-out infinite`, animationDelay: `${i * 0.4}s`, opacity: 0.7 }} />
                ))}
                <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{deviceDef.icon}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "var(--text2)" }}>Scanning for {deviceDef.name}…</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>Make sure the device is powered on and in range</div>
          </>
        )}
        {phase === "found" && (
          <>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Found {foundDevices.length} device{foundDevices.length !== 1 ? "s" : ""}. Select one to connect:</div>
            {foundDevices.map(d => (
              <div key={d.id} onClick={() => connectDevice(d)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg2)", cursor: "pointer", marginBottom: 8, transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#111"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                <div style={{ width:36,height:36,background:"var(--bg3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--border)" }}><Icon name={deviceDef.icon} size={18} color="var(--text2)" /></div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                  {d.rssi && <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text3)" }}>Signal: {d.rssi} dBm</div>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>Tap to pair →</div>
              </div>
            ))}
          </>
        )}
        {phase === "connecting" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Spin dark /></div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "var(--text2)" }}>Connecting to {selectedDevice?.name}…</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>Establishing secure connection</div>
          </>
        )}
        {phase === "success" && (
          <>
            <div style={{width:56,height:56,background:"var(--green-bg)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:"1px solid var(--green-border)"}}><Icon name="check" size={28} color="#16A34A" /></div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: "#16A34A", letterSpacing: 1 }}>CONNECTED!</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>Setting up data sync…</div>
          </>
        )}
        {phase === "error" && (
          <>
            <div style={{width:56,height:56,background:"var(--red-bg)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:"1px solid var(--red-border)"}}><Icon name="x" size={28} color="var(--red)" /></div>
            <div className="auth-error" style={{ textAlign: "left", marginBottom: 16 }}>{errorMsg}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={retry}>Try Again</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
        {phase !== "error" && phase !== "success" && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 20 }} onClick={onClose}>Cancel</button>
        )}
      </div>
    </ModalWrapper>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEVICES PAGE — full state machine per device
═══════════════════════════════════════════════════════════ */

function DevicesPage({ profile, setBiometrics }) {
  const toast = useToast();
  const [devices, setDevices] = useDevices(profile.id);
  const [syncing, setSyncing] = useState({});
  const [scanModal, setScanModal] = useState(null); // deviceDef | null
  const [liveHR, setLiveHR] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const polarRef = useRef(null);

  const handleConnected = useCallback((deviceId, connectionData) => {
    if (connectionData.btRef) { polarRef.current = connectionData.btRef; }
    const { btRef: _btRef, ...clean } = connectionData;
    setDevices(p => ({ ...p, [deviceId]: { ...clean, connected: true, status: "connected", syncHistory: [] } }));
    toast("Connected successfully!", "success");
  }, [setDevices, toast]);

  const disconnect = useCallback((deviceId) => {
    if (deviceId === "polar_h10") {
      if (streaming) stopStream();
      polarRef.current?.server?.disconnect?.();
      polarRef.current = null;
    }
    setDevices(p => ({ ...p, [deviceId]: { ...p[deviceId], connected: false, status: "disconnected" } }));
    toast(`${DeviceService.SUPPORTED.find(d => d.id === deviceId)?.name} disconnected.`, "warn");
  }, [setDevices, toast, streaming]);

  const sync = useCallback(async (deviceId) => {
    setSyncing(p => ({ ...p, [deviceId]: true }));
    try {
      let metrics;
      if (deviceId === "apple_watch") metrics = await DeviceService.syncAppleWatch();
      else if (deviceId === "google_fit") metrics = await DeviceService.syncGoogleFit();
      else { throw new Error("Polar H10 requires Bluetooth. Use the live HR stream feature instead."); }

      const readiness = DeviceService.computeReadiness(metrics);
      setBiometrics(p => {
        const next = { ...p };
        if (metrics.resting_heart_rate) next.rhr = Math.round(metrics.resting_heart_rate);
        if (metrics.hrv) next.hrv = Math.round(metrics.hrv);
        if (metrics.sleep) next.sleep = Math.round(metrics.sleep * 10) / 10;
        if (metrics.heart_rate) next.heart_rate = Math.round(metrics.heart_rate);
        next.readiness = readiness;
        next.history = [...(p.history || []), readiness].slice(-14);
        return next;
      });

      setDevices(p => ({
        ...p, [deviceId]: {
          ...p[deviceId], lastSync: Date.now(), lastMetrics: metrics,
          syncHistory: [{ ts: Date.now(), metrics }, ...(p[deviceId]?.syncHistory || [])].slice(0, 10),
        }
      }));
      toast("Sync complete. Readiness updated.", "success");
    } catch (e) {
      toast("Sync failed: " + e.message, "error");
    }
    setSyncing(p => ({ ...p, [deviceId]: false }));
  }, [setDevices, setBiometrics, toast]);

  const startStream = useCallback(async () => {
    if (!polarRef.current?.hrChar) { toast("Polar H10 not connected.", "error"); return; }
    try {
      const char = polarRef.current.hrChar;
      const handler = (e) => {
        const { hr } = DeviceService.parseHRMeasurement(e.target.value);
        setLiveHR(hr);
        setBiometrics(p => ({ ...p, heart_rate: hr }));
        setDevices(p => ({ ...p, polar_h10: { ...p.polar_h10, liveHR: hr, lastSync: Date.now() } }));
      };
      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", handler);
      polarRef.current.hrHandler = handler;
      setStreaming(true);
      toast("Heart rate streaming started.", "success");
    } catch (e) { toast("Could not start streaming: " + e.message, "error"); }
  }, [toast, setDevices, setBiometrics]);

  const stopStream = useCallback(async () => {
    try {
      const char = polarRef.current?.hrChar;
      if (char) {
        await char.stopNotifications();
        if (polarRef.current.hrHandler) char.removeEventListener("characteristicvaluechanged", polarRef.current.hrHandler);
      }
    } catch {}
    setStreaming(false); setLiveHR(null);
    toast("Heart rate streaming stopped.", "warn");
  }, [toast]);

  const fmtSync = (ts) => {
    if (!ts) return "Never synced";
    const d = Date.now() - ts;
    if (d < 60000) return "Just now";
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div>
      {scanModal && (
        <DeviceScanModal
          deviceDef={scanModal}
          onConnected={(data) => handleConnected(scanModal.id, data)}
          onClose={() => setScanModal(null)}
        />
      )}

      <div className="topbar">
        <div><h1>DEVICES</h1><div className="topbar-meta">WEARABLE INTEGRATIONS Â· HEALTH DATA SYNC</div></div>
      </div>

      {streaming && liveHR && (
        <div className="alert-banner alert-green" style={{ marginBottom: 16 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", marginTop: 5, animation: "pulse 0.8s infinite", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 1, color: "#16A34A" }}>LIVE: {liveHR} BPM</div>
            <div className="alert-desc">Polar H10 streaming Â· ECG-accurate Â· updates every second</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={stopStream}>Stop</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {DeviceService.SUPPORTED.map((def) => {
          const d = devices[def.id] || {};
          const connected = d.connected === true;
          const isSyncing = syncing[def.id];

          return (
            <div key={def.id} className="card flat">
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: connected ? "#F0FDF4" : "var(--bg3)", border: `2px solid ${connected ? "#BBF7D0" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  <Icon name={def.icon} size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 1 }}>{def.name}</div>
                    <span className={connected ? "chip chip-green" : "chip chip-gray"}>{connected ? "Connected" : "Not Connected"}</span>
                    {d.battery != null && <span className="chip chip-yellow" style={{display:"inline-flex",alignItems:"center",gap:4}}><Icon name="battery" size={11} />{d.battery}%</span>}
                    {streaming && def.id === "polar_h10" && liveHR && <span className="chip chip-green" style={{display:"inline-flex",alignItems:"center",gap:4}}><StatusDot status="active" size={5} />{liveHR} bpm LIVE</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8, lineHeight: 1.5 }}>{def.description}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {def.metrics.map(m => <span key={m} className="chip chip-gray" style={{ fontSize: 9, padding: "2px 7px" }}>{m}</span>)}
                  </div>
                  {connected && (
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text3)" }}>
                      {fmtSync(d.lastSync)}{d.deviceName ? ` Â· ${d.deviceName}` : ""}
                    </div>
                  )}
                  {/* Last metrics strip */}
                  {connected && d.lastMetrics && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {[["HR", d.lastMetrics.heart_rate, "bpm"], ["RHR", d.lastMetrics.resting_heart_rate, "bpm"], ["HRV", d.lastMetrics.hrv, "ms"], ["Sleep", d.lastMetrics.sleep, "h"], ["Steps", d.lastMetrics.steps?.toLocaleString(), ""], ["Cal", d.lastMetrics.calories?.toLocaleString(), "kcal"]].filter(([, v]) => v != null).map(([k, v, u]) => (
                        <div key={k} style={{ background: "var(--bg2)", borderRadius: 8, padding: "5px 9px", border: "1px solid var(--border)" }}>
                          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: "var(--text3)", textTransform: "uppercase" }}>{k}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 700, marginTop: 1 }}>{v}{u ? " " + u : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                  {!connected ? (
                    <button className="btn btn-primary btn-sm" onClick={() => setScanModal(def)}>Connect</button>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => sync(def.id)} disabled={isSyncing}>
                        {isSyncing ? <><Spin dark />{" "}Syncing…</> : "Sync"}
                      </button>
                      {def.id === "polar_h10" && (
                        <button className={`btn btn-sm ${streaming ? "btn-danger" : "btn-yellow"}`} onClick={streaming ? stopStream : startStream}>
                          {streaming ? "Stop" : "Stream HR"}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)", borderColor: "#FECACA", fontSize: 11 }} onClick={() => disconnect(def.id)}>
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync history */}
      <div className="card flat" style={{ marginTop: 16 }}>
        <SectionHeader title="SYNC HISTORY" />
        {Object.entries(devices).some(([, d]) => d.lastSync) ? (
          Object.entries(devices).filter(([, d]) => d.lastSync)
            .sort((a, b) => b[1].lastSync - a[1].lastSync)
            .map(([id, d]) => {
              const def = DeviceService.SUPPORTED.find(x => x.id === id);
              return (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width:28,height:28,background:"var(--bg3)",borderRadius:7,display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--border)" }}><Icon name={def?.icon || "watch"} size={14} color="var(--text2)" /></span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{def?.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text3)" }}>{new Date(d.lastSync).toLocaleString()}</div>
                    </div>
                  </div>
                  <span className="chip chip-green" style={{display:"inline-flex",alignItems:"center",gap:4}}><StatusDot status="connected" size={5} />Synced</span>
                </div>
              );
            })
        ) : (
          <Empty icon="sync" title="NO SYNCS YET" desc="Connect a device above to start syncing your health data." />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROFILE PAGE — complete with all functional sections
═══════════════════════════════════════════════════════════ */

function ProfilePage({ profile, setProfile, authUser, onLogout }) {
  const toast = useToast();
  const [section, setSection] = useState("main"); // main | edit | password | email | support | delete
  const [avatarUrl, setAvatarUrl] = useState(() => ProfileService.getAvatar(profile.id));
  const [showLogout, setShowLogout] = useState(false);
  const fileRef = useRef();

  // Edit form state
  const [form, setForm] = useState({
    name: profile.name || "", age: profile.age || "", height: profile.height || "",
    weight: profile.weight || "", sport: profile.sport || SPORTS[0],
    team: profile.team || "",
  });
  const [saving, setSaving] = useState(false);

  // Password form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  // Email form
  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [emailSaving, setEmailSaving] = useState(false);

  // Support form
  const [supportForm, setSupportForm] = useState({ type: "feedback", subject: "", message: "" });
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportTicket, setSupportTicket] = useState(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handlePicChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await ProfileService.uploadAvatar(profile.id, file);
      setAvatarUrl(url);
      setProfile(p => ({ ...p, avatarUrl: url }));
      toast("Profile picture updated.");
    } catch (e) { toast(e.message, "error"); }
    e.target.value = "";
  };

  const removePic = async () => {
    await ProfileService.removeAvatar(profile.id);
    setAvatarUrl(null);
    setProfile(p => ({ ...p, avatarUrl: null }));
    toast("Profile picture removed.");
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const saved = await ProfileService.save(profile.id, { ...profile, ...form });
      setProfile(p => ({ ...p, ...saved }));
      setSection("main");
      toast("Profile saved successfully.");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const savePassword = async () => {
    setPwSaving(true);
    try {
      await AuthService.updatePassword(pwForm.current, pwForm.next, pwForm.confirm);
      setPwForm({ current: "", next: "", confirm: "" });
      setSection("main");
      toast("Password updated successfully.");
    } catch (e) { toast(e.message, "error"); }
    setPwSaving(false);
  };

  const saveEmail = async () => {
    setEmailSaving(true);
    try {
      await AuthService.updateEmail(emailForm.email, emailForm.password);
      setProfile(p => ({ ...p, email: emailForm.email }));
      setEmailForm({ email: "", password: "" });
      setSection("main");
      toast("Email address updated.");
    } catch (e) { toast(e.message, "error"); }
    setEmailSaving(false);
  };

  const submitSupport = async () => {
    setSupportSaving(true);
    try {
      const ticket = await ProfileService.submitFeedback(profile.id, supportForm);
      setSupportTicket(ticket);
      setSupportForm({ type: "feedback", subject: "", message: "" });
      toast(`Ticket ${ticket.id} submitted. We'll be in touch.`);
    } catch (e) { toast(e.message, "error"); }
    setSupportSaving(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await ProfileService.deleteAccount(profile.id, deleteConfirm);
      toast("Account deleted.", "warn");
      onLogout();
    } catch (e) { toast(e.message, "error"); }
    setDeleting(false);
  };

  const NavBtn = ({ id, label }) => (
    <button className={`btn ${section === id ? "btn-primary" : "btn-ghost"} btn-sm`} onClick={() => setSection(id)} style={{ fontSize: 12 }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      {showLogout && <LogoutModal onConfirm={onLogout} onCancel={() => setShowLogout(false)} />}
      <div className="topbar">
        <div><h1>PROFILE</h1><div className="topbar-meta">PERSONAL SETTINGS Â· ACCOUNT</div></div>
      </div>

      {/* Profile Header Card */}
      <div className="card flat" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div className="profile-pic-wrap" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--border)", display: "block" }} />
                : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--text1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 28, color: "var(--accent)", border: "3px solid var(--border)" }}>{inits(profile.name)}</div>
              }
              <div className="profile-pic-overlay"><Icon name="camera" size={16} color="#fff" /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePicChange} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, letterSpacing: 2 }}>{profile.name}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{profile.email}</div>
            {authUser?.provider === "google" && <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Signed in with Google</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="chip chip-black" style={{ textTransform: "capitalize" }}>{profile.role}</span>
              <span className="chip chip-gray">{profile.sport}</span>
              {profile.weight && <span className="chip chip-gray">{profile.weight} kg</span>}
              {profile.height && <span className="chip chip-gray">{profile.height} cm</span>}
              {profile.age && <span className="chip chip-gray">Age {profile.age}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            {avatarUrl && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--red)" }} onClick={removePic}>Remove Photo</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setSection("edit")}>Edit Profile</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <NavBtn id="edit" label="Edit Info" />
          <NavBtn id="password" label="Password" />
          <NavBtn id="email" label="Email" />
          <NavBtn id="support" label="Support" />
          <NavBtn id="delete" label="Delete Account" />
        </div>
      </div>

      {/* EDIT PROFILE */}
      {section === "edit" && (
        <div className="card flat" style={{ marginBottom: 14 }}>
          <SectionHeader title="EDIT PROFILE" subtitle="Changes are saved to your account." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["name", "Full Name", "text", "Your full name"], ["age", "Age", "number", "e.g. 24"], ["height", "Height (cm)", "number", "e.g. 180"], ["weight", "Weight (kg)", "number", "e.g. 75"], ["team", "Team / Club", "text", "Optional"]].map(([k, l, t, ph]) => (
              <div key={k} className="input-wrap" style={{ marginBottom: 0 }}>
                <label className="input-lbl">{l}</label>
                <input className="input-field" type={t} placeholder={ph} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="input-wrap" style={{ marginBottom: 0 }}>
              <label className="input-lbl">Sport</label>
              <select className="input-field" value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? <><Spin />{" "}Saving…</> : "Save Changes"}</button>
            <button className="btn btn-ghost" onClick={() => setSection("main")}>Cancel</button>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD */}
      {section === "password" && (
        <div className="card flat" style={{ marginBottom: 14 }}>
          <SectionHeader title="CHANGE PASSWORD" subtitle="Must be at least 8 characters." />
          {[["current", "Current Password"], ["next", "New Password"], ["confirm", "Confirm New Password"]].map(([k, l]) => (
            <div key={k} className="input-wrap">
              <label className="input-lbl">{l}</label>
              <input className="input-field" type="password" placeholder="••••••••" value={pwForm[k]} onChange={e => setPwForm(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" onClick={savePassword} disabled={pwSaving}>{pwSaving ? <><Spin />{" "}Updating…</> : "Update Password"}</button>
            <button className="btn btn-ghost" onClick={() => setSection("main")}>Cancel</button>
          </div>
        </div>
      )}

      {/* CHANGE EMAIL */}
      {section === "email" && (
        <div className="card flat" style={{ marginBottom: 14 }}>
          <SectionHeader title="CHANGE EMAIL" subtitle={`Current: ${profile.email}`} />
          <div className="input-wrap">
            <label className="input-lbl">New Email Address</label>
            <input className="input-field" type="email" placeholder="new@email.com" value={emailForm.email} onChange={e => setEmailForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Current Password (to confirm)</label>
            <input className="input-field" type="password" placeholder="••••••••" value={emailForm.password} onChange={e => setEmailForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={saveEmail} disabled={emailSaving}>{emailSaving ? <><Spin />{" "}Updating…</> : "Update Email"}</button>
            <button className="btn btn-ghost" onClick={() => setSection("main")}>Cancel</button>
          </div>
        </div>
      )}

      {/* SUPPORT */}
      {section === "support" && (
        <div className="card flat" style={{ marginBottom: 14 }}>
          <SectionHeader title="SUPPORT & FEEDBACK" subtitle="We respond within 24 hours." />
          {supportTicket && (
            <div className="alert-banner alert-green" style={{ marginBottom: 16 }}>
              <div className="alert-dot" />
              <div><div className="alert-title">TICKET SUBMITTED</div><div className="alert-desc">Reference: {supportTicket.id} Â· We'll contact you at {profile.email}</div></div>
            </div>
          )}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {[["feedback", "Feedback"], ["bug", "Bug Report"], ["question", "Question"]].map(([v, l]) => (
              <div key={v} className={`tab${supportForm.type === v ? " active" : ""}`} onClick={() => setSupportForm(p => ({ ...p, type: v }))}>{l}</div>
            ))}
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Subject</label>
            <input className="input-field" placeholder="Brief description" value={supportForm.subject} onChange={e => setSupportForm(p => ({ ...p, subject: e.target.value }))} />
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Message</label>
            <textarea className="input-field" rows={5} placeholder="Describe your issue or feedback in detail…" value={supportForm.message} onChange={e => setSupportForm(p => ({ ...p, message: e.target.value }))} style={{ resize: "vertical", minHeight: 100 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={submitSupport} disabled={supportSaving}>{supportSaving ? <><Spin />{" "}Submitting…</> : "Submit"}</button>
            <button className="btn btn-ghost" onClick={() => setSection("main")}>Cancel</button>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT */}
      {section === "delete" && (
        <div className="card flat" style={{ marginBottom: 14, border: "1px solid #FECACA", background: "#FEF2F2" }}>
          <SectionHeader title="DELETE ACCOUNT" subtitle="This action is permanent and cannot be undone." />
          <div style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            Deleting your account will permanently remove all your profile data, training history, biometrics, device connections, and settings. This cannot be recovered.
          </div>
          <div className="input-wrap">
            <label className="input-lbl">Type <strong>DELETE</strong> to confirm</label>
            <input className="input-field" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={{ fontFamily: "'IBM Plex Mono'", letterSpacing: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting || deleteConfirm !== "DELETE"}>
              {deleting ? <><Spin />{" "}Deleting…</> : "Permanently Delete Account"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setSection("main"); setDeleteConfirm(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* LOGOUT */}
      <div className="card flat" style={{ border: "1px solid #FECACA", background: "#FEF2F2" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 2, color: "var(--red)", marginBottom: 4 }}>SIGN OUT</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Session will be cleared. Your data will be preserved on this device.</div>
        <button className="btn btn-danger" onClick={() => setShowLogout(true)}>Log Out of Recovo</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS PAGE — full, all persisted
═══════════════════════════════════════════════════════════ */

function SettingsPage({ profile }) {
  const toast = useToast();
  const { settings, updateSettings, updateNested } = useSettings(profile.id);
  const { lang, switchLang } = useLang();
  const { theme, setTheme } = useTheme();
  const { t } = useLang();
  const [activeSection, setActiveSection] = useState("notifications");
  const [securityForm, setSecurityForm] = useState({ twoFactor: false, loginAlerts: true });
  const [savingSection, setSavingSection] = useState(null);

  const persist = async (section, patch) => {
    setSavingSection(section);
    await updateNested(section, patch);
    setSavingSection(null);
    toast(t("save") + " Â·", "success");
  };

  const SECTIONS = [
    { id: "notifications", label: t("notifications"), icon: "bell" },
    { id: "privacy",       label: t("privacy"),       icon: "shield" },
    { id: "security",      label: t("security"),       icon: "lock" },
    { id: "appearance",    label: t("appearance"),     icon: "settings" },
    { id: "language",      label: t("language"),       icon: "map" },
    { id: "units",         label: t("units"),          icon: "barChart" },
    { id: "account",       label: t("account"),        icon: "profile" },
  ];

  const ToggleRow = ({ labelKey, descKey, section, field, value }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                  padding:"14px 0", borderBottom:"1px solid var(--border)", gap:16 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:500, color:"var(--text1)" }}>{t(labelKey)}</div>
        {descKey && <div style={{ fontSize:12, color:"var(--text2)", marginTop:3, lineHeight:1.5 }}>{t(descKey)}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        {savingSection === section && <Spin dark />}
        <Toggle checked={value} onChange={v => persist(section, { [field]: v })} />
      </div>
    </div>
  );

  const LANGS = [
    { v:"en", l:"English", native:"English" },
    { v:"fr", l:"French", native:"FranÃ§ais" },
    { v:"es", l:"Spanish", native:"EspaÃ±ol" },
    { v:"de", l:"German", native:"Deutsch" },
    { v:"hi", l:"Hindi", native:"à¤¹à¤¿à¤¨à¥à¤¦à¥€" },
  ];

  const THEMES = [
    { v:"light",  l: t("lightMode"),  ico:"zap" },
    { v:"dark",   l: t("darkMode"),   ico:"moon" },
    { v:"system", l: t("systemTheme"), ico:"settings" },
  ];

  const UNITS_CONFIG = [
    { label: t("weight"),      key:"weight",   opts:[{v:"kg",l:"Kilograms (kg)"},{v:"lbs",l:"Pounds (lbs)"}] },
    { label: t("distance"),    key:"distance", opts:[{v:"km",l:"Kilometres (km)"},{v:"miles",l:"Miles (mi)"}] },
    { label: t("temperature"), key:"temp",     opts:[{v:"celsius",l:"Celsius (Â°C)"},{v:"fahrenheit",l:"Fahrenheit (Â°F)"}] },
  ];

  return (
    <div style={{ maxWidth:700 }}>
      <div className="topbar">
        <div>
          <h1>{t("settingsTitle").toUpperCase()}</h1>
          <div className="topbar-meta">{t("appearance").toUpperCase()} Â· {t("privacy").toUpperCase()} Â· {t("notifications").toUpperCase()}</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
        {SECTIONS.map(s => (
          <button key={s.id}
            className={`btn btn-sm ${activeSection === s.id ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize:12, display:"inline-flex", alignItems:"center", gap:6 }}
            onClick={() => setActiveSection(s.id)}>
            <Icon name={s.icon} size={12} />
            {s.label}
          </button>
        ))}
      </div>

      {/* NOTIFICATIONS */}
      {activeSection === "notifications" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("notifications").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Choose which alerts you receive from Recovo.</div>
          </div>
          <ToggleRow labelKey="dailyReadiness" descKey="dailyReadinessDesc" section="notifications" field="readiness" value={settings.notifications?.readiness ?? true} />
          <ToggleRow labelKey="coachAlerts" descKey="coachAlertsDesc" section="notifications" field="coachAlerts" value={settings.notifications?.coachAlerts ?? true} />
          <ToggleRow labelKey="injuryWarnings" descKey="injuryWarningsDesc" section="notifications" field="injuryWarnings" value={settings.notifications?.injuryWarnings ?? true} />
          <ToggleRow labelKey="weeklyReport" descKey="weeklyReportDesc" section="notifications" field="weeklyReport" value={settings.notifications?.weeklyReport ?? true} />
          <ToggleRow labelKey="sessionReminder" descKey="sessionReminderDesc" section="notifications" field="sessionReminder" value={settings.notifications?.sessionReminder ?? false} />
          <ToggleRow labelKey="deviceSync" descKey="deviceSyncDesc" section="notifications" field="deviceSync" value={settings.notifications?.deviceSync ?? true} />
        </div>
      )}

      {/* PRIVACY */}
      {activeSection === "privacy" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("privacy").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Control what your coach and Recovo can access.</div>
          </div>
          <ToggleRow labelKey="shareReadiness" descKey="shareReadinessDesc" section="privacy" field="shareReadiness" value={settings.privacy?.shareReadiness ?? true} />
          <ToggleRow labelKey="shareBiometrics" descKey="shareBiometricsDesc" section="privacy" field="shareBiometrics" value={settings.privacy?.shareBiometrics ?? true} />
          <ToggleRow labelKey="shareWorkouts" descKey="shareWorkoutsDesc" section="privacy" field="shareWorkouts" value={settings.privacy?.shareWorkouts ?? false} />
          <ToggleRow labelKey="analytics" descKey="analyticsDesc" section="privacy" field="analytics" value={settings.privacy?.analytics ?? true} />
        </div>
      )}

      {/* SECURITY */}
      {activeSection === "security" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("security").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Manage authentication and account security.</div>
          </div>
          <ToggleRow labelKey="twoFactor" descKey="twoFactorDesc" section="security" field="twoFactor" value={settings.security?.twoFactor ?? false} />
          <ToggleRow labelKey="loginAlerts" descKey="loginAlertsDesc" section="security" field="loginAlerts" value={settings.security?.loginAlerts ?? true} />
          <div style={{ marginTop:20, padding:"16px", background:"var(--bg2)", borderRadius:"var(--radius)", border:"1px solid var(--border)" }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Active Sessions</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>You are currently signed in on 1 device.</div>
            <button className="btn btn-ghost btn-sm" style={{ color:"var(--red)", borderColor:"var(--red-border)" }}
              onClick={() => toast("All other sessions signed out.", "success")}>
              Sign Out Other Sessions
            </button>
          </div>
        </div>
      )}

      {/* APPEARANCE / THEME */}
      {activeSection === "appearance" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("appearance").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Choose how Recovo looks on your device.</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {THEMES.map(th => (
              <button key={th.v}
                onClick={() => { setTheme(th.v); toast(`Theme set to ${th.l}.`); }}
                style={{
                  padding:"18px 12px", borderRadius:"var(--radius-lg)",
                  border:`2px solid ${theme === th.v ? "var(--accent)" : "var(--border)"}`,
                  background: theme === th.v ? "var(--bg3)" : "var(--bg2)",
                  cursor:"pointer", display:"flex", flexDirection:"column",
                  alignItems:"center", gap:10, transition:"all var(--transition)",
                }}>
                <div style={{ width:40, height:40, borderRadius:"var(--radius)",
                  background: th.v === "dark" ? "#111" : th.v === "light" ? "#fff" : "linear-gradient(135deg,#fff 50%,#111 50%)",
                  border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name={th.ico} size={16} color={th.v === "dark" ? "#fff" : th.v === "system" ? "var(--text2)" : "#111"} />
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text1)" }}>{th.l}</div>
                {theme === th.v && <StatusDot status="active" size={6} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LANGUAGE */}
      {activeSection === "language" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("language").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Interface language. Takes effect instantly.</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {LANGS.map(({ v, l, native }) => (
              <button key={v}
                onClick={() => { switchLang(v); toast(`Language set to ${l}.`); }}
                style={{
                  padding:"16px 18px", borderRadius:"var(--radius-lg)",
                  border:`2px solid ${lang === v ? "var(--accent)" : "var(--border)"}`,
                  background: lang === v ? "var(--bg3)" : "var(--bg2)",
                  cursor:"pointer", display:"flex", alignItems:"center", gap:12,
                  transition:"all var(--transition)", textAlign:"left",
                }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--text1)" }}>{native}</div>
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{l}</div>
                </div>
                {lang === v && <Icon name="check" size={16} color="var(--accent)" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* UNITS */}
      {activeSection === "units" && (
        <div className="card flat">
          <div style={{ marginBottom:20 }}>
            <div className="sec-title">{t("units").toUpperCase()}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Measurement preferences for health metrics.</div>
          </div>
          {UNITS_CONFIG.map(({ label, key, opts }) => (
            <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                                     padding:"14px 0", borderBottom:"1px solid var(--border)", gap:16 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:"var(--text1)" }}>{label}</div>
                <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>
                  Currently: {opts.find(o => o.v === (settings.units?.[key] || opts[0].v))?.l}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {opts.map(o => (
                  <button key={o.v}
                    className={`btn btn-sm ${(settings.units?.[key] || opts[0].v) === o.v ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize:12 }}
                    onClick={() => { updateNested("units", { [key]: o.v }); toast(t("save") + " Â·"); }}>
                    {o.v.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACCOUNT */}
      {activeSection === "account" && (
        <div>
          <div className="card flat" style={{ marginBottom:12 }}>
            <div className="sec-title" style={{ marginBottom:16 }}>{t("account").toUpperCase()}</div>
            {[
              { label: t("emailAddress"), value: profile.email, icon: "mail" },
              { label: t("accountType"), value: profile.role === "coach" ? "Coach Account" : "Athlete Account", icon: "profile" },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 0", borderBottom:"1px solid var(--border)" }}>
                <div style={{ width:32, height:32, borderRadius:"var(--radius-sm)", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon name={icon} size={14} color="var(--text2)" />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:"var(--text2)", fontFamily:"'IBM Plex Mono'", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:500, color:"var(--text1)", marginTop:2 }}>{value}</div>
                </div>
              </div>
            ))}
            <div style={{ padding:"13px 0" }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:4, color:"var(--text1)" }}>{t("dataPrivacy")}</div>
              <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.6 }}>{t("dataPrivacyDesc")}</div>
            </div>
          </div>

          <div className="card flat" style={{ marginBottom:12 }}>
            <div className="sec-title" style={{ marginBottom:16 }}>{t("about").toUpperCase()}</div>
            {[["Version","1.0.0"],["Build","2025.06"],["Platform","Web PWA"],["Storage","Local Device"]].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:13, color:"var(--text2)" }}>{k}</span>
                <span style={{ fontSize:13, fontWeight:500, fontFamily:"'IBM Plex Mono'", color:"var(--text1)" }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:16, flexWrap:"wrap" }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { StorageService.clear(); toast("Cache cleared."); }}>
                <Icon name="trash" size={12} />{t("clearCache")}
              </button>
              <button className="btn btn-ghost btn-sm"
                onClick={() => {
                  const data = {};
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k?.startsWith("rv_")) data[k] = localStorage.getItem(k);
                  }
                  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = "recovo_export.json"; a.click();
                  toast(t("exportData") + " Â·");
                }}>
                <Icon name="upload" size={12} />{t("exportData")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   PWA INSTALLER — injects manifest + meta tags + SW registration
═══════════════════════════════════════════════════════════ */

function usePWA() {
  useEffect(() => {
    // Inject viewport meta for mobile
    let vm = document.querySelector('meta[name="viewport"]');
    if (!vm) {
      vm = document.createElement("meta");
      vm.name = "viewport";
      document.head.appendChild(vm);
    }
    vm.content = "width=device-width,initial-scale=1,viewport-fit=cover";

    // Theme color
    let tc = document.querySelector('meta[name="theme-color"]');
    if (!tc) { tc = document.createElement("meta"); tc.name = "theme-color"; document.head.appendChild(tc); }
    tc.content = "#FFD600";

    // Apple PWA meta
    const apples = [
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "default"],
      ["apple-mobile-web-app-title", "Recovo"],
    ];
    apples.forEach(([n, c]) => {
      if (!document.querySelector(`meta[name="${n}"]`)) {
        const m = document.createElement("meta"); m.name = n; m.content = c; document.head.appendChild(m);
      }
    });

    // Manifest (inline blob)
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = {
        name: "Recovo — Elite Athlete Platform",
        short_name: "Recovo",
        description: "Real-time athlete monitoring, readiness tracking and injury prevention.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FFFFFF",
        theme_color: "#FFD600",
        icons: [
          { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='40' fill='%23FFD600'/%3E%3Ctext x='96' y='140' font-family='Arial Black' font-size='110' text-anchor='middle' fill='%23111'%3ER%3C/text%3E%3C/svg%3E", sizes: "192x192", type: "image/svg+xml" },
          { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='100' fill='%23FFD600'/%3E%3Ctext x='256' y='370' font-family='Arial Black' font-size='300' text-anchor='middle' fill='%23111'%3ER%3C/text%3E%3C/svg%3E", sizes: "512x512", type: "image/svg+xml" },
        ],
        categories: ["health", "fitness", "sports"],
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      const link = document.createElement("link");
      link.rel = "manifest"; link.href = URL.createObjectURL(blob);
      document.head.appendChild(link);
    }

    // Service Worker registration (basic offline cache)
    if ("serviceWorker" in navigator) {
      const swCode = `
const CACHE='recovo-v1';
const PRECACHE=['/'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(cached=>{
    const net=fetch(e.request).then(res=>{
      if(res.ok){const c=res.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
      return res;
    }).catch(()=>cached);
    return cached||net;
  }));
});
`;
      const swBlob = new Blob([swCode], { type: "application/javascript" });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }

    // Allow native scroll on body
    document.body.style.overscrollBehavior = "contain";
  }, []);
}

/* ═══════════════════════════════════════════════════════════
   PULL-TO-REFRESH HOOK
═══════════════════════════════════════════════════════════ */

function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const el = useRef(null);

  const onTouchStart = useCallback((e) => { startY.current = e.touches[0].clientY; }, []);
  const onTouchEnd = useCallback(async (e) => {
    const dy = e.changedTouches[0].clientY - startY.current;
    const scrollTop = el.current?.scrollTop || 0;
    if (dy > 60 && scrollTop <= 0) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, onTouchStart, onTouchEnd, ref: el };
}

/* ═══════════════════════════════════════════════════════════
   APP SHELL — mobile-first with bottom tab bar
═══════════════════════════════════════════════════════════ */

function AppShell({ user, authUser, profile, setProfile, onLogout }) {
  usePWA();
  const isCoach = profile.role === "coach";
  const [page, setPage] = useState("dashboard");
  const [workouts, setWorkouts] = usePersistedState("workouts_" + profile.id, []);
  const [biometrics, setBiometrics] = usePersistedState("bio_" + profile.id, {});
  const [legionInfo, setLegionInfo] = usePersistedState("legion_a_" + profile.id, null);
  const [legion, setLegion] = usePersistedState("legion_c_" + profile.id, null);
  const [athletes, setAthletes] = useState([]);

  useEffect(() => {
    if (!isCoach) setAthletes([]);
  }, [isCoach]);

  // Real-time Legion subscription for both coach and athlete
  useEffect(() => {
    if (!profile?.legionId) {
      if (isCoach) setLegion(null);
      else setLegionInfo(null);
      return;
    }

    const legionRef = ref(db, `legions/${profile.legionId}`);
    const unsubscribeLegion = onValue(legionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (isCoach) {
          setLegion({
            id: data.id,
            name: data.name,
            code: data.inviteCode,
            sport: data.sport
          });
        } else {
          setLegionInfo({
            id: data.id,
            name: data.name,
            code: data.inviteCode,
            sport: data.sport,
            coachName: "Coach",
            members: Object.keys(data.athleteUids || {}).length
          });
        }
      }
    });

    return () => unsubscribeLegion();
  }, [profile?.legionId, isCoach]);

  // Real-time Roster sync for Coach
  useEffect(() => {
    if (!isCoach || !legion?.id) {
      setAthletes([]);
      return;
    }

    const legionRef = ref(db, `legions/${legion.id}`);
    const activeUnsubs = [];

    const unsubscribeLegionRoster = onValue(legionRef, (snapshot) => {
      // Clean up previous sub-listeners
      activeUnsubs.forEach(unsub => unsub());
      activeUnsubs.length = 0;

      if (!snapshot.exists()) {
        setAthletes([]);
        return;
      }

      const data = snapshot.val();
      const athleteUids = Object.keys(data.athleteUids ?? {});

      if (athleteUids.length === 0) {
        setAthletes([]);
        return;
      }

      const athletesData = {};

      const updateAthleteData = (uid, fresh) => {
        athletesData[uid] = { ...(athletesData[uid] || {}), ...fresh };

        const list = athleteUids.map(id => {
          const athlete = athletesData[id] || {};
          const p = athlete.profile || {};
          const s = athlete.latestStatus || {};
          const r = athlete.latestRecovery || {};
          return {
            id,
            name: p.name || "Unknown Athlete",
            sport: p.sport || legion.sport || "Football",
            readiness: r.recoveryScore != null ? r.recoveryScore : null,
            hrv: r.hrv || null,
            rhr: r.rhr || null,
            sleep: r.sleepHours || null,
            status: s.mood ? {
              mood: s.mood >= 4 ? "High" : s.mood <= 2 ? "Low" : "Medium",
              energy: s.energy >= 4 ? "High" : s.energy <= 2 ? "Low" : "Medium",
              stress: s.stress >= 4 ? "High" : s.stress <= 2 ? "Low" : "Medium",
              note: s.notes || ""
            } : null,
            history: []
          };
        });

        setAthletes(list);
      };

      athleteUids.forEach((uid) => {
        // Subscribe to user profile
        const profileRef = ref(db, `users/${uid}`);
        const unsubProfile = onValue(profileRef, (snap) => {
          updateAthleteData(uid, { profile: snap.val() || {} });
        });
        activeUnsubs.push(unsubProfile);

        // Subscribe to status
        const statusRef = ref(db, `daily_status/${uid}`);
        const unsubStatus = onValue(statusRef, (snap) => {
          const statuses = snap.exists() ? Object.values(snap.val()) : [];
          const latestStatus = statuses.sort((a, b) => b.date - a.date)[0] ?? null;
          updateAthleteData(uid, { latestStatus });
        });
        activeUnsubs.push(unsubStatus);

        // Subscribe to recovery
        const recoveryRef = ref(db, `recovery/${uid}`);
        const unsubRecovery = onValue(recoveryRef, (snap) => {
          const recoveries = snap.exists() ? Object.values(snap.val()) : [];
          const latestRecovery = recoveries.sort((a, b) => b.date - a.date)[0] ?? null;
          updateAthleteData(uid, { latestRecovery });
        });
        activeUnsubs.push(unsubRecovery);
      });
    });

    return () => {
      unsubscribeLegionRoster();
      activeUnsubs.forEach(unsub => unsub());
    };
  }, [isCoach, legion?.id]);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const athleteNav = [
    { id: "dashboard", ico: "dashboard", lbl: "Home" },
    { id: "tracks", ico: "tracks", lbl: "Tracks" },
    { id: "recovery", ico: "recovery", lbl: "Recovery" },
    { id: "injuries", ico: "injuries", lbl: "Injuries" },
    { id: "daily", ico: "daily", lbl: "Status" },
    { id: "legion", ico: "legion", lbl: "Legion" },
    { id: "devices", ico: "devices", lbl: "Devices" },
  ];
  const coachNav = [
    { id: "dashboard", ico: "devices", lbl: "Readiness" },
    { id: "legion", ico: "legion", lbl: "Legion" },
    { id: "athletes", ico: "athletes", lbl: "Athletes" },
  ];
  const fullNav = isCoach ? coachNav : athleteNav;

  // Mobile bottom nav shows max 4 items + more; desktop shows all
  const bottomNav = isMobile
    ? [...fullNav.slice(0, 4), { id: "profile", ico: "profile", lbl: "Me" }]
    : fullNav;

  const renderPage = () => {
    if (page === "profile") return <ProfilePage profile={profile} setProfile={setProfile} authUser={authUser} onLogout={onLogout} />;
    if (page === "settings") return <SettingsPage profile={profile} />;
    if (page === "devices") return <DevicesPage profile={profile} setBiometrics={setBiometrics} />;
    if (isCoach) {
      if (page === "legion") return <LegionCoachPage legion={legion} setLegion={setLegion} athletes={athletes} profile={profile} />;
      if (page === "athletes") return <AthletesDeepDive athletes={athletes} />;
      return <CoachDashboard legion={legion} athletes={athletes} />;
    }
    if (page === "tracks") return <TracksPage profile={profile} workouts={workouts} setWorkouts={setWorkouts} />;
    if (page === "recovery") return <RecoveryPage profile={profile} biometrics={biometrics} setBiometrics={setBiometrics} />;
    if (page === "injuries") return <InjuriesPage />;
    if (page === "daily") return <DailyStatusPage legionInfo={legionInfo} onSubmit={() => {}} />;
    if (page === "legion") return <LegionAthletePage profile={profile} legionInfo={legionInfo} setLegionInfo={setLegionInfo} />;
    return <AthleteDashboard profile={profile} workouts={workouts} biometrics={biometrics} legionInfo={legionInfo} />;
  };

  const pageTitle = [...athleteNav, ...coachNav, { id: "profile", lbl: "Profile" }, { id: "settings", lbl: "Settings" }, { id: "devices", lbl: "Devices" }].find(n => n.id === page)?.lbl || "Recovo";

  return (
    <ToastProvider>
      <div className="app-shell">

        {/* ── DESKTOP SIDEBAR ── */}
        <nav className="sidebar">
          <div className="nav-logo">R</div>
          <div className="nav-section">MENU</div>
          {fullNav.map(item => (
            <div key={item.id} className={`nav-item${page === item.id ? " active" : ""}`} onClick={() => setPage(item.id)} title={item.lbl}>
              <span className="nav-ico"><Icon name={item.ico} size={16} /></span>
              <span className="nav-lbl">{item.lbl}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div className="nav-section">ACCOUNT</div>
          <div className={`nav-item${page === "settings" ? " active" : ""}`} onClick={() => setPage("settings")} title="Settings">
            <span className="nav-ico"><Icon name="settings" size={16} /></span>
            <span className="nav-lbl">Settings</span>
          </div>
          <div className={`nav-item${page === "profile" ? " active" : ""}`} onClick={() => setPage("profile")} title="Profile">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} alt="" />
              : <span className="nav-ico"><Icon name="profile" size={16} /></span>}
            <span className="nav-lbl">Profile</span>
          </div>
        </nav>

        {/* ── MOBILE HEADER ── */}
        <div className="mobile-header">
          <div className="mobile-header-logo">
            <div className="mobile-header-logo-mark">R</div>
            <div className="mobile-header-title">{pageTitle.toUpperCase()}</div>
          </div>
          <div className="mobile-header-right">
            {page !== "settings" && (
              <div style={{ fontSize: 20, cursor: "pointer", padding: "4px 6px", borderRadius: 8, WebkitTapHighlightColor: "transparent", display:"flex",alignItems:"center" }}
                onClick={() => setPage("settings")}><Icon name="settings" size={18} color="var(--text2)" /></div>
            )}
            <div className="mobile-avatar" onClick={() => setPage("profile")}>
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt="" />
                : inits(profile.name)
              }
            </div>
          </div>
        </div>

        {/* ── PAGE CONTENT ── */}
        <main className="main-content">{renderPage()}</main>

        {/* ── MOBILE BOTTOM TAB BAR ── */}
        <div className="bottom-nav">
          <div className="bottom-nav-inner">
            {bottomNav.map(item => (
              <div key={item.id}
                className={`bnav-item${page === item.id ? " active" : ""}`}
                onClick={() => setPage(item.id)}>
                <span className="bnav-ico">
                  {item.id === "profile" && profile.avatarUrl
                    ? <img src={profile.avatarUrl} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: page === "profile" ? "2px solid #111" : "2px solid transparent" }} alt="" />
                    : item.ico
                  }
                </span>
                <span className="bnav-lbl">{item.lbl}</span>
                <div className="bnav-dot" />
              </div>
            ))}
            {/* More menu item for remaining athlete pages on mobile */}
            {isMobile && !isCoach && (
              <div className={`bnav-item${["recovery","injuries","daily","legion","devices","settings"].includes(page) ? " active" : ""}`}
                onClick={() => setPage(["recovery","injuries","daily","legion","devices","settings"].includes(page) ? page : "recovery")}>
                <span className="bnav-ico"><Icon name="more" size={20} /></span>
                <span className="bnav-lbl">More</span>
                <div className="bnav-dot" />
              </div>
            )}
          </div>
          {/* More pages drawer for mobile */}
          {isMobile && !isCoach && ["recovery","injuries","daily","legion","devices","settings"].includes(page) && (
            <div style={{ display: "flex", gap: 4, padding: "8px 12px 4px", borderTop: "1px solid var(--border)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {[{ id: "recovery", ico: "recovery", lbl: "Recovery" }, { id: "injuries", ico: "injuries", lbl: "Injuries" }, { id: "daily", ico: "daily", lbl: "Status" }, { id: "legion", ico: "legion", lbl: "Legion" }, { id: "devices", ico: "devices", lbl: "Devices" }, { id: "settings", ico: "settings", lbl: "Settings" }].map(item => (
                <button key={item.id}
                  className={`btn btn-sm ${page === item.id ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: 11, padding: "6px 10px", flexShrink: 0, whiteSpace: "nowrap" }}
                  onClick={() => setPage(item.id)}>
                  {item.ico} {item.lbl}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </ToastProvider>
  );
}


/* ═══════════════════════════════════════════════════════════
   ROOT — Auth-gated entry point
═══════════════════════════════════════════════════════════ */

export default function App() {
  const [screen, setScreen] = useState("boot"); // boot | landing | auth | onboarding | app
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Subscribe to Firebase auth and profile state changes
  useEffect(() => {
    let unsubProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setAuthUser(null);
        setProfile(null);
        setScreen("landing");
        return;
      }

      const formattedUser = {
        id: user.uid,
        uid: user.uid,
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        avatar: user.photoURL,
        provider: user.providerData[0]?.providerId || "google",
        createdAt: Date.now()
      };
      setAuthUser(formattedUser);

      // Subscribe to profile changes in real-time
      const profileRef = ref(db, `users/${user.uid}`);
      unsubProfile = onValue(profileRef, (snap) => {
        if (snap.exists()) {
          const loadedProfile = snap.val();
          setProfile(loadedProfile);
          if (loadedProfile.sport) {
            setScreen("app");
          } else {
            setScreen("onboarding");
          }
        } else {
          setProfile(null);
          setScreen("onboarding");
        }
      }, (err) => {
        console.error("Failed to load user profile in real-time:", err);
        setProfile(null);
        setScreen("onboarding");
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleOnboard = async (data) => {
    const p = { id: authUser.id, email: authUser.email, name: authUser.name, avatarUrl: authUser.avatar || null, ...data, streak: 0, createdAt: Date.now() };
    const saved = await ProfileService.save(p.id, p).catch(() => p);
    setProfile(saved);
    setScreen("app");
  };

  const handleLogout = () => {
    AuthService.signOut();
    setAuthUser(null); setProfile(null); setScreen("landing");
  };

  if (screen === "boot") {
    return (
      <ThemeProvider>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg2)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, background: "var(--accent)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 26, color: "#0A0A0B" }}>R</div>
            <Spin dark />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {screen === "landing" && <LandingPage onGetStarted={() => setScreen("auth")} />}
      {screen === "auth" && <AuthPage />}
      {screen === "onboarding" && authUser && <Onboarding user={authUser} onComplete={handleOnboard} />}
      {screen === "app" && profile && (
        <ThemeProvider>
          <LangProvider>
            <AppShell user={authUser} authUser={authUser} profile={profile} setProfile={setProfile} onLogout={handleLogout} />
          </LangProvider>
        </ThemeProvider>
      )}
    </>
  );
}
