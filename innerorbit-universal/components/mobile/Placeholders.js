import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from "@expo/vector-icons";

export const StoriesView = ({ THEME, isDesktop }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, paddingTop: 60, paddingBottom: isDesktop ? 20 : 120 }}>
    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(236, 72, 153, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, transform: [{ rotate: '90deg' }] }}>
      <Feather name="layers" size={32} color="#EC4899" />
    </View>
    <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Stories</Text>
    <Text style={{ color: THEME.textSecondary, textAlign: 'center', marginBottom: 4 }}>24-Hour Status Updates</Text>
    <Text style={{ color: THEME.primary, fontSize: 14, fontWeight: 'bold', marginTop: 12 }}>COMING SOON</Text>
    <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 4, opacity: 0.7 }}>Future Update</Text>
  </View>
);
