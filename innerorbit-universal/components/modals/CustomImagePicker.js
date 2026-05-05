/** Purpose: Custom gallery picker for selecting profile and message images. */
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, FlatList, Image, ActivityIndicator, Dimensions } from 'react-native';
import { select } from "../../utils/platform";
import * as MediaLibrary from 'expo-media-library';
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from '../../store/themeStore';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

export const CustomImagePicker = ({ visible, onClose, onSelect }) => {
    const { theme: THEME } = useAppTheme();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState(null);

    useEffect(() => {
        if (visible) {
            requestPermission();
        }
    }, [visible]);

    const requestPermission = async () => {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status === 'granted') {
            loadPhotos();
        } else {
            setLoading(false);
        }
    };

    const loadPhotos = async () => {
        try {
            setLoading(true);
            const { assets } = await MediaLibrary.getAssetsAsync({
                first: 50,
                mediaType: 'photo',
                sortBy: ['creationTime'],
            });
            setAssets(assets);
        } catch (error) {
            console.error("Error loading photos:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => (
        <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => ({
                width: ITEM_SIZE,
                height: ITEM_SIZE,
                padding: 1,
                opacity: pressed ? 0.7 : 1
            })}
        >
            <Image
                source={{ uri: item.uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
        </Pressable>
    );

    if (!visible) return null;

    return (
        <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
            zIndex: 1500 // Below GlobalHeader (2000)
        }}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <View style={{
                height: '80%',
                backgroundColor: THEME.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: 'hidden',
                ...select({
                    ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                    },
                    android: {
                        elevation: 20,
                    },
                    web: {
                        boxShadow: '0px -4px 10px rgba(0, 0, 0, 0.3)',
                    },
                })
            }}>
                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: THEME.border
                }}>
                    <Pressable onPress={onClose} style={{ padding: 4 }}>
                        <Feather name="x" size={24} color={THEME.text} />
                    </Pressable>
                    <Text style={{ color: THEME.text, fontSize: 18, fontWeight: 'bold' }}>Select Photo</Text>
                    <View style={{ width: 32 }} />
                </View>

                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={THEME.primary} />
                    </View>
                ) : hasPermission === false ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                        <Feather name="image" size={48} color={THEME.textSecondary} style={{ marginBottom: 16 }} />
                        <Text style={{ color: THEME.text, fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
                            Permission to access gallery was denied. Please enable it in settings.
                        </Text>
                        <Pressable
                            onPress={requestPermission}
                            style={{ backgroundColor: THEME.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                        </Pressable>
                    </View>
                ) : (
                    <FlatList
                        data={assets}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                )}
            </View>
        </View>
    );
};
