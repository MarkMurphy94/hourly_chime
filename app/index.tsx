import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, Switch, Button, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

//TODO: fix delay issue- implement in kotlin files
//TODO: change time text in push n. to readable time
//TODO: day picker


Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
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

export default function chimeView() {
    const [expoPushToken, setExpoPushToken] = useState('');
    const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();
    const CHIME_STORAGE_KEY = 'chimes';
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

    const loadchimesFromStorage = async () => {
        try {
            const storedchimes = await AsyncStorage.getItem(CHIME_STORAGE_KEY);
            return storedchimes ? JSON.parse(storedchimes) : null;
        } catch (error) {
            console.error('Failed to load chimes:', error);
            return null;
        }
    };

    const removeValue = async () => {
        try {
            await AsyncStorage.removeItem('chimes')
        } catch (e) {
            console.log('error: ', e)
        }

        console.log('Done.')
    }

    useEffect(() => {
        // removeValue()
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
            // handle response here
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
        console.log(chimes)
    }, []);

    async function registerForPushNotificationsAsync() {
        let token;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('chimes2', {
                name: 'hourly_chime',
                importance: Notifications.AndroidImportance.MAX,
                // vibrationPattern: [0, 250, 250, 250],
                enableVibrate: false,
                lightColor: '#FF231F7C',
                sound: "twangy_old_clock.wav",
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
                console.log(token);
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
                title: "The time is " + hour.toString(),
                // vibrate: [0, 250, 250, 250]
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                // seconds: 10,
                channelId: 'chimes2',
                hour: hour,
                minute: 0,
            },
        });
        return identifier
    }

    const togglechime = (chime_id: string) => {
        setchimes((prevchimes) =>
            prevchimes.map((chime) => {
                if (chime.id === chime_id) {
                    const newEnabledState = !chime.enabled;
                    if (newEnabledState) {
                        // Enable chime and set identifier
                        enableChime(chime.hour).then((notification_id) => {
                            setchimes((currentchimes) => {
                                const chimesWithId = currentchimes.map((a) =>
                                    a.id === chime_id ? { ...a, identifier: notification_id } : a
                                )
                                savechimesToStorage(chimesWithId); // Save after update
                                console.log('Enabled chime ID: ', notification_id)
                                return chimesWithId;
                            });
                        });
                    } else {
                        // Disable chime and cancel notification
                        if (chime.identifier) {
                            Notifications.cancelScheduledNotificationAsync(chime.identifier);
                            setchimes((currentchimes) => {
                                const chimesWithoutId = currentchimes.map((a) =>
                                    a.id === chime_id ? { ...a, identifier: null, enabled: false } : a
                                )
                                savechimesToStorage(chimesWithoutId); // Save after update
                                console.log('Disabled chime ID: ', chime.identifier)
                                return chimesWithoutId;
                            });
                        }
                    }
                    return { ...chime, enabled: newEnabledState };
                }
                return chime;
            })
        );
    };

    const chooseSound = (id: String) => {
        alert(`Choose sound for chime ID: ${id}`);
    };

    const renderchimeItem = ({ item }) => (
        <TouchableOpacity style={styles.chimeCard} onPress={() => togglechime(item.id)}>
            <View style={styles.chimeContent}>
                <Text style={styles.chimeTime}>{item.time}</Text>
                {/* <Button style={styles.soundButton} title='choose sound' onPress={() => chooseSound(item.id)} /> */}
                <Switch
                    value={item.enabled}
                    onValueChange={() => togglechime(item.id)}
                />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>chimes</Text>
            <FlatList
                data={chimes}
                renderItem={renderchimeItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
            />
            {/* <Link href={'/notifications_page'}> got to page</Link> */}
            {/* <Button style={styles.addButton} title='Test a notification' onPress={togglechime}>
            </Button> */}
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
