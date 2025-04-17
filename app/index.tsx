import React, { useState, useEffect, useRef } from 'react';
import { Stack, Link } from 'expo-router';
import { View, Text, FlatList, Switch, Modal, Pressable, Alert, Button, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Device from 'expo-device';
import { NOTIFICATION_CHANNEL_ID, CHIME_STORAGE_KEY, DAYS_STORAGE_KEY, DEFAULT_SOUND } from '../globals';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';


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
    // identifier: string | null; // Allow `identifier` to be a string or null
    identifiers: Record<number, string>
};

export default function chimeView() {
    const [expoPushToken, setExpoPushToken] = useState('');
    const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();
    const [modalVisible, setModalVisible] = useState(false);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

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
            identifiers: {},
        }));

    const [chimes, setChimes] = useState<Chime[]>(generatechimes());

    const saveChimesToStorage = async (chimes: Chime[]) => {
        try {
            await AsyncStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(chimes));
        } catch (error) {
            console.error('Failed to save chimes:', error);
        }
    };

    const saveDaysToStorage = async (days: number[]) => {
        // console.log('saving days: ', days)
        try {
            await AsyncStorage.setItem(DAYS_STORAGE_KEY, JSON.stringify(days));
        } catch (error) {
            console.error('Failed to save days:', error);
        }
    };

    const clearOldNotificationChannelsIfPresent = async () => {
        const channels = await Notifications.getNotificationChannelsAsync()
        channels.forEach(channel => {
            if (channel.id !== NOTIFICATION_CHANNEL_ID) {
                Notifications.deleteNotificationChannelAsync(channel.id)
            }
        });
    }

    const loadChimesFromStorage = async () => {
        try {
            const storedchimes = await AsyncStorage.getItem(CHIME_STORAGE_KEY);
            return storedchimes ? JSON.parse(storedchimes) : null;
        } catch (error) {
            console.error('Failed to load chimes:', error);
            return null;
        }
    };

    const loadDaysFromStorage = async () => {
        try {
            const storedDays = await AsyncStorage.getItem(DAYS_STORAGE_KEY);
            return storedDays ? JSON.parse(storedDays) : null;
        } catch (error) {
            console.error('Failed to load days:', error);
            return null;
        }
    };

    useEffect(() => {
        clearOldNotificationChannelsIfPresent()
        // Notifications.cancelAllScheduledNotificationsAsync(); // cos the fucking things wouldnt stop....
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

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    useEffect(() => {
        loadDaysFromStorage().then((savedDays) => {
            if (savedDays) {
                setSelectedDays(savedDays);
            }
        });
        loadChimesFromStorage().then((savedchimes) => {
            if (savedchimes) {
                setChimes(savedchimes);
            } else {
                setChimes(generatechimes()); // Default chimes if none are saved
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

    async function enableChime(hour: number, day: number) {
        const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                title: "The time is " + formatTime12Hour(hour),
                priority: Notifications.AndroidNotificationPriority.MAX,
                interruptionLevel: 'timeSensitive',
                // sound: "twangy_old_clock_louder.wav",
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                channelId: NOTIFICATION_CHANNEL_ID,
                weekday: day + 1, // 1-7 for Sunday-Saturday
                hour: hour,
                minute: 0,
                // seconds: 10,
            },
        });
        return identifier
    }

    const toggleChime = async (chime_id: string) => {
        const chime = chimes.find((c) => c.id === chime_id);
        if (!chime) return;

        if (!chime.enabled) {
            // Enable chime for all selected days
            const identifiers: Record<number, string> = {};
            for (const day of selectedDays) {
                try {
                    const id = await enableChime(chime.hour, day);
                    identifiers[day] = id;
                } catch (error) {
                    console.error(`Failed to enable chime for day ${day}:`, error);
                }
            }
            updateChimeState(chime_id, identifiers, true);
        } else {
            // Disable all scheduled notifications for this chime
            const ids = Object.values(chime.identifiers);
            for (const id of ids) {
                await Notifications.cancelScheduledNotificationAsync(id);
            }
            updateChimeState(chime_id, {}, false);
        }
    };

    const toggleChimeByDay = (index: number) => {
        setSelectedDays(prevSelected => {
            const updatedDays = prevSelected.includes(index)
                ? prevSelected.filter(day => day !== index)
                : [...prevSelected, index];

            updateScheduledChimesForSelectedDays(updatedDays);
            return updatedDays;
        });
    };

    const updateScheduledChimesForSelectedDays = async (newSelectedDays: number[]) => {
        const updatedChimes = await Promise.all(chimes.map(async (chime) => {
            if (!chime.enabled) return chime;

            // Cancel existing notifications for days no longer selected
            for (const [day, id] of Object.entries(chime.identifiers)) {
                const dayNum = Number(day);
                if (!newSelectedDays.includes(dayNum)) {
                    await Notifications.cancelScheduledNotificationAsync(id);
                    delete chime.identifiers[dayNum]; // Remove identifier for deselected day
                }
            }

            const newIdentifiers: Record<number, string> = { ...chime.identifiers };

            // Remove identifiers for deselected days
            for (const day of Object.keys(newIdentifiers)) {
                if (!newSelectedDays.includes(Number(day))) {
                    delete newIdentifiers[Number(day)];
                }
            }

            // Schedule new notifications for newly added days
            for (const day of newSelectedDays) {
                if (!newIdentifiers[day]) {
                    const id = await enableChime(chime.hour, day);
                    newIdentifiers[day] = id;
                }
            }

            return {
                ...chime,
                identifiers: newIdentifiers,
            };
        }));

        setChimes(updatedChimes);
        saveChimesToStorage(updatedChimes);
        saveDaysToStorage(newSelectedDays)
        console.log('updated chimes: ', updatedChimes)
    };

    // Helper function to update chimes in state & storage
    const updateChimeState = (
        chime_id: string,
        identifiers: Record<number, string>,
        enabled: boolean
    ) => {
        setChimes((currentChimes) => {
            const updatedChimes = currentChimes.map((chime) =>
                chime.id === chime_id ? { ...chime, identifiers, enabled } : chime
            );
            saveChimesToStorage(updatedChimes);
            return updatedChimes;
        });
    };

    const renderchimeItem = ({ item }) => (
        <View style={styles.chimeCard}>
            <View style={styles.chimeContent}>
                <Text style={styles.chimeTime}>{item.time}</Text>
                {/* <Button style={styles.soundButton} title='choose sound' onPress={() => chooseSound(item.id)} /> */}
                <Switch
                    onValueChange={() => toggleChime(item.id)}
                    value={item.enabled}
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
            <View style={styles.WeekContainer}>
                {days.map((day, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.circle, selectedDays.includes(index) && styles.selectedCircle]}
                        onPress={() => toggleChimeByDay(index)}
                    >
                        <Text style={[styles.text, selectedDays.includes(index) && styles.selectedText]}>{day}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Image style={styles.modalImage} source={require("../assets/images/clipart2804211.png")} />
                        <Text style={styles.modalText}>Thank you for downloading the Hourly Chime Grandfather Clock app!</Text>
                        <Text style={styles.modalText}>Simply toggle the hours and days you want chimes for, and a chime will be scheduled for that time.</Text>
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
    WeekContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 20,
    },
    circle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    selectedCircle: {
        backgroundColor: 'blue',
    },
    text: {
        fontSize: 16,
        color: '#000',
    },
    selectedText: {
        color: '#fff',
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
