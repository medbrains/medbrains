import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "alert" | "promotion" | "health_tip";
  priority: number;
  image_url?: string;
  display_seconds: number;
}

interface SignageUpdate {
  type: "signage_update";
  announcements: Announcement[];
  ticker_messages: string[];
  hospital_name: string;
  tagline: string;
}

const TYPE_COLORS: Record<Announcement["type"], { bg: string; accent: string }> = {
  info: { bg: "#1a3a5e", accent: "#228be6" },
  alert: { bg: "#5e1a1a", accent: "#fa5252" },
  promotion: { bg: "#1a5e3a", accent: "#40c057" },
  health_tip: { bg: "#5e4a1a", accent: "#fab005" },
};

const TYPE_ICONS: Record<Announcement["type"], string> = {
  info: "ℹ️",
  alert: "⚠️",
  promotion: "🎉",
  health_tip: "💡",
};

function AnnouncementSlide({ announcement }: { announcement: Announcement }) {
  const colors = TYPE_COLORS[announcement.type];
  const icon = TYPE_ICONS[announcement.type];

  return (
    <View style={[styles.slide, { backgroundColor: colors.bg }]}>
      <View style={styles.slideContent}>
        <Text style={styles.slideIcon}>{icon}</Text>
        <View style={[styles.slideAccent, { backgroundColor: colors.accent }]} />
        <Text style={styles.slideTitle}>{announcement.title}</Text>
        <Text style={styles.slideText}>{announcement.content}</Text>
      </View>
    </View>
  );
}

function TickerBar({ messages }: { messages: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <View style={styles.ticker}>
      <Text style={styles.tickerText}>📢 {messages[currentIndex]}</Text>
    </View>
  );
}

export function DigitalSignageScreen() {
  const [signageData, setSignageData] = useState<SignageUpdate | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/signage`,
    onMessage: (data) => {
      const update = data as SignageUpdate;
      if (update.type === "signage_update") {
        setSignageData(update);
      }
    },
  });

  // Auto-rotate slides
  useEffect(() => {
    const announcements = signageData?.announcements || [];
    if (announcements.length === 0) return;

    const displayTime = (announcements[currentSlide]?.display_seconds || 10) * 1000;

    const timer = setTimeout(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide((prev) => (prev + 1) % announcements.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, displayTime);

    return () => clearTimeout(timer);
  }, [currentSlide, signageData, fadeAnim]);

  const announcements = signageData?.announcements || [];
  const tickerMessages = signageData?.ticker_messages || [];
  const hospitalName = signageData?.hospital_name || "MedBrains Hospital";
  const tagline = signageData?.tagline || "Excellence in Healthcare";
  const currentAnnouncement = announcements[currentSlide];

  // Default content when no announcements
  const defaultAnnouncement: Announcement = {
    id: "default",
    title: "Welcome to " + hospitalName,
    content: tagline,
    type: "info",
    priority: 0,
    display_seconds: 10,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hospitalName}>{hospitalName}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>
        <View style={styles.dateTime}>
          <Text style={styles.time}>
            {currentTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text style={styles.date}>
            {currentTime.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <Animated.View style={[styles.mainContent, { opacity: fadeAnim }]}>
        <AnnouncementSlide
          announcement={currentAnnouncement || defaultAnnouncement}
        />
      </Animated.View>

      {/* Slide Indicators */}
      {announcements.length > 1 && (
        <View style={styles.indicators}>
          {announcements.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentSlide && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Ticker */}
      <TickerBar messages={tickerMessages} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 32,
    paddingBottom: 16,
  },
  hospitalName: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  tagline: {
    color: "#888888",
    fontSize: 18,
  },
  dateTime: {
    alignItems: "flex-end",
  },
  time: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
  },
  date: {
    color: "#888888",
    fontSize: 18,
  },
  mainContent: {
    flex: 1,
    padding: 32,
    paddingTop: 0,
  },
  slide: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  slideContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 64,
  },
  slideIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  slideAccent: {
    width: 120,
    height: 6,
    borderRadius: 3,
    marginBottom: 32,
  },
  slideTitle: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
  },
  slideText: {
    color: "#ffffff",
    fontSize: 28,
    textAlign: "center",
    opacity: 0.9,
    maxWidth: "80%",
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 16,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#333333",
  },
  indicatorActive: {
    backgroundColor: "#ffffff",
    width: 36,
  },
  ticker: {
    backgroundColor: "#1a1a2e",
    padding: 16,
  },
  tickerText: {
    color: "#ffffff",
    fontSize: 20,
    textAlign: "center",
  },
});
