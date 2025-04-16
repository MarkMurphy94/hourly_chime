import React, { useState, useEffect, useRef } from 'react';
import { Stack, Link } from 'expo-router';
import { View, Text, FlatList, Switch, Modal, Pressable, Alert, Button, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Device from 'expo-device';
import { NOTIFICATION_CHANNEL_ID, CHIME_STORAGE_KEY, DEFAULT_SOUND } from '../globals';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';


Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

type Chime = {
    id: string;
    time: string;
    hour: number;
    enabled: boolean;
    identifier: string | null; // Allow `identifier` to be a string or null
};

const APP_LAUNCH_COUNT_KEY = 'app_launch_count';
const HAS_PROMPTED_KEY = 'has_prompted_for_review';

export default function chimeView() {
    const [expoPushToken, setExpoPushToken] = useState('');
    const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();
    const [modalVisible, setModalVisible] = useState(false);

    const formatTime12Hour = (hour: number): string => {
        const period = hour < 12 ? "AM" : "PM";
        const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM, and 12 to 12 PM
        return `${hour12}:00 ${period}`;
    };

    const generatechimes = (): Chime[] =>
        Array.from({ length: 24 }, (_, hour) => ({
            id: `chime-${hour}`,
            time: formatTime12Hour(hour),
            hour,
            enabled: false,
            identifier: null,
        }));

    const [chimes, setchimes] = useState<Chime[]>(generatechimes());

    const savechimesToStorage = async (chimes: Chime[]) => {
        try {
            await AsyncStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(chimes));
        } catch (error) {
            console.error('Failed to save chimes:', error);
        }
    };

    const clearOldNotificationChannelsIfPresent = async () => {
        const channels = await Notifications.getNotificationChannelsAsync()
        channels.forEach(channel => {
            if (channel.id !== NOTIFICATION_CHANNEL_ID) {
                Notifications.deleteNotificationChannelAsync(channel.id)
            }
        });
        // console.log('channels: ', channels)
    }

    const loadchimesFromStorage = async () => {
        try {
            const storedchimes = await AsyncStorage.getItem(CHIME_STORAGE_KEY);
            return storedchimes ? JSON.parse(storedchimes) : null;
        } catch (error) {
            console.error('Failed to load chimes:', error);
            return null;
        }
    };

    const checkAndMaybeRequestReview = async () => {
        try {
            const launchCountRaw = await AsyncStorage.getItem(APP_LAUNCH_COUNT_KEY);
            const hasPromptedRaw = await AsyncStorage.getItem(HAS_PROMPTED_KEY);

            const launchCount = launchCountRaw ? parseInt(launchCountRaw, 10) : 0;
            const hasPrompted = hasPromptedRaw === 'true';

            const newLaunchCount = launchCount + 1;
            await AsyncStorage.setItem(APP_LAUNCH_COUNT_KEY, newLaunchCount.toString());

            // Trigger on 3rd or 4th launch only, and if user hasn’t already been prompted
            if ((newLaunchCount === 3 || newLaunchCount === 4) && !hasPrompted) {
                if (await StoreReview.isAvailableAsync()) {
                    StoreReview.requestReview();
                    await AsyncStorage.setItem(HAS_PROMPTED_KEY, 'true');
                }
            }

        } catch (error) {
            console.warn('Error handling review prompt:', error);
        }
    };

    useEffect(() => {
        checkAndMaybeRequestReview()
        clearOldNotificationChannelsIfPresent()
        registerForPushNotificationsAsync().then(token => token && setExpoPushToken(token));

        if (Platform.OS === 'android') {
            Notifications.getNotificationChannelsAsync().then(value => setChannels(value ?? []));
        }
        notificationListener.current = Notifications.addNotificationReceivedListener((new_notification) => {
            console.log('notification while app is running: ', new_notification)
            setNotification(new_notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log(response);
            console.log('responding to notification')
        });
        // Notifications.cancelAllScheduledNotificationsAsync(); // cos the fucking things wouldnt stop....

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    useEffect(() => {
        loadchimesFromStorage().then((savedchimes) => {
            if (savedchimes) {
                setchimes(savedchimes);
            } else {
                setchimes(generatechimes()); // Default chimes if none are saved
            }
        });
    }, []);

    async function registerForPushNotificationsAsync() {
        // TODO: access custom sounds
        let token;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
                name: 'Chimes',
                importance: Notifications.AndroidImportance.MAX,
                enableVibrate: false,
                lightColor: '#FF231F7C',
                sound: DEFAULT_SOUND,
                // vibrationPattern: [0, 250, 250, 250],
                audioAttributes: {
                    usage: Notifications.AndroidAudioUsage.NOTIFICATION,
                    contentType: Notifications.AndroidAudioContentType.SONIFICATION,
                }
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                alert('Failed to get push token for push notification!');
                return;
            }
            try {
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                if (!projectId) {
                    throw new Error('Project ID not found');
                }
                token = (
                    await Notifications.getExpoPushTokenAsync({
                        projectId,
                    })
                ).data;
            } catch (e) {
                token = `${e}`;
            }
        } else {
            alert('Must use physical device for Push Notifications');
        }
        return token;
    }

    async function enableChime(hour: number) {
        const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                title: "The time is " + formatTime12Hour(hour),
                priority: Notifications.AndroidNotificationPriority.MAX,
                interruptionLevel: 'timeSensitive',
                // sound: "twangy_old_clock_louder.wav",
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                // seconds: 10,
                channelId: NOTIFICATION_CHANNEL_ID,
                hour: hour,
                minute: 0,
            },
        });
        return identifier
    }

    const togglechime = async (chime_id: string) => {
        setchimes((prevChimes) =>
            prevChimes.map((chime) =>
                chime.id === chime_id ? { ...chime, enabled: !chime.enabled } : chime
            )
        );

        const chime = chimes.find((c) => c.id === chime_id);
        if (!chime) return;

        if (!chime.enabled) {
            // Enable chime
            try {
                const notification_id = await enableChime(chime.hour);
                updateChimeState(chime_id, notification_id, true);
                console.log("Enabled chime ID: ", notification_id);
            } catch (error) {
                console.error("Failed to enable chime:", error);
            }
        } else {
            // Disable chime
            if (chime.identifier) {
                await Notifications.cancelScheduledNotificationAsync(chime.identifier);
                updateChimeState(chime_id, null, false);
                console.log("Disabled chime ID: ", chime.identifier);
            }
        }
    };

    // Helper function to update chimes in state & storage
    const updateChimeState = (chime_id: string, identifier: string | null, enabled: boolean) => {
        setchimes((currentChimes) => {
            const updatedChimes = currentChimes.map((chime) =>
                chime.id === chime_id ? { ...chime, identifier, enabled } : chime
            );
            savechimesToStorage(updatedChimes);
            return updatedChimes;
        });
    };

    const chooseSound = (id: String) => {
        alert(`Choose sound for chime ID: ${id}`);
    };

    const renderchimeItem = ({ item }) => (
        <View style={styles.chimeCard}>
            <View style={styles.chimeContent}>
                <Text style={styles.chimeTime}>{item.time}</Text>
                {/* <Button style={styles.soundButton} title='choose sound' onPress={() => chooseSound(item.id)} /> */}
                <Switch
                    value={item.enabled}
                    onValueChange={() => togglechime(item.id)}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Chimes',
                    // headerStyle: { backgroundColor: '#000' },
                    // headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                        fontFamily: 'guavine_demo_regular'
                    },
                    headerRight: () => (
                        <TouchableOpacity onPressIn={() => setModalVisible(true)} style={styles.headerButton}>
                            <Text style={styles.headerButtonText}>?</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Image style={styles.modalImage} source={require("../assets/images/clipart2804211.png")} />
                        <Text style={styles.modalText}>Thank you for downloading the Hourly Chime Grandfather Clock app!</Text>
                        <Text style={styles.modalText}>Simply toggle the hours you want chimes for, and a daily chime will be scheduled for that hour.</Text>
                        <Text style={styles.modalText}>If your chimes are not working, try following these steps. PLEASE NOTE: These settings may be slightly different on your phone:</Text>
                        <Text style={styles.modalText}>1. Open your phone's settings and look for the battery settings.</Text>
                        <Text style={styles.modalText}>2. Open the Background Usage Limits setting, and add this app to the list of "Never auto sleeping" apps.</Text>
                        {/* <Text style={styles.modalText}>PLEASE NOTE: These settings may look slightly different on your phone.</Text> */}
                        <Pressable
                            style={[styles.button, styles.buttonClose]}
                            onPress={() => setModalVisible(!modalVisible)}>
                            <Text style={styles.textStyle}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
            <FlatList
                data={chimes}
                renderItem={renderchimeItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
            />
            {/* <Link href="/HelpText">open modal </Link> */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f4f5',
        padding: 16,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1f2937',
    },
    listContainer: {
        paddingBottom: 16,
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2,
    },
    buttonClose: {
        backgroundColor: 'black',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
    },
    modalImage: {
        width: 100,
        height: 100,
        // backgroundColor: 'white',
    },
    headerButton: {
        marginRight: 15,
        padding: 10,
        width: 38,
        height: 38,
        backgroundColor: 'white',
        borderRadius: 38 / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtonText: {
        color: 'black',
        fontSize: 18,
        fontWeight: 'bold',
    },
    chimeCard: {
        marginBottom: 12,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    chimeContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chimeTime: {
        fontSize: 18,
        fontWeight: '500',
        color: '#374151',
    },
    addButton: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 12,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 16,
        marginLeft: 8,
        fontWeight: '500',
    },
});

// export default chimeView;
