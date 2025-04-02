import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Button, Alert, Platform } from "react-native";
import Slider from '@react-native-community/slider';
import { Stack } from "expo-router";
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { MenuProvider, Menu, MenuOptions, MenuOption, MenuTrigger, } from 'react-native-popup-menu';
import * as IntentLauncher from 'expo-intent-launcher';
import { NOTIFICATION_CHANNEL_ID } from '../globals';
import { getPackageJson } from 'expo/config';

export default function settings() {

    const AVAILABLE_SOUNDS = [
        'gong_sounding_clock.mp3',
        'single_ding.mp3',
        'ting_tung.aiff',
        'twangy_old_clock_louder.wav'
    ];


    const changeSound = async () => {
        // TODO: clean up html
        if (Platform.OS !== 'android') {
            Alert.alert(
                'Notification Settings',
                'Notification settings can only be modified on Android devices.'
            );
            return;
        }

        try {
            const appPackage = 'com.markmurphy94.hourly_chime'
            console.log(appPackage)
            await IntentLauncher.startActivityAsync(
                "android.settings.CHANNEL_NOTIFICATION_SETTINGS", // IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
                {
                    extra: {
                        'android.provider.extra.APP_PACKAGE': 'com.markmurphy94.hourly_chime',
                        'android.provider.extra.CHANNEL_ID': NOTIFICATION_CHANNEL_ID
                    }
                }
            );
        } catch (error) {
            console.error('Error opening notification settings:', error);
            Alert.alert(
                'Error',
                'Could not open notification settings. Please check your device settings manually.'
            );
        }
    };

    return (
        <MenuProvider>
            <View style={styles.container}>
                <Stack.Screen
                    options={{
                        title: 'Settings',
                        headerTitleStyle: {
                            fontWeight: 'bold',
                            fontFamily: 'guavine_demo_regular'
                        },
                    }}
                />
                <View style={styles.settingItem}>
                    <TouchableOpacity onPress={() => changeSound()}>
                        <Text style={styles.label}>Chime notification settings</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </MenuProvider>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#f9f9f9",
    },
    header: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 20,
    },
    settingItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginVertical: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    label: {
        fontSize: 18,
        color: "#333",
    },
    subTitle: {
        fontSize: 15,
        color: "#333",
    },
});