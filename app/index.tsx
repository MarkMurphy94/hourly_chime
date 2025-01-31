import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, Switch, Button, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

//TODO: fix asyncstorage of alarms- first one is always enabled?
//TODO: Change chime sound
//TODO: Test it out for a day or two

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

type Alarm = {
    id: string;
    time: string;
    hour: number;
    enabled: boolean;
    identifier: string | null; // Allow `identifier` to be a string or null
};

export default function AlarmView() {
    const [expoPushToken, setExpoPushToken] = useState('');
    const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();
    const ALARM_STORAGE_KEY = 'alarms';
    const formatTime12Hour = (hour: number): string => {
        const period = hour < 12 ? "AM" : "PM";
        const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM, and 12 to 12 PM
        return `${hour12}:00 ${period}`;
    };
    const generateAlarms = (): Alarm[] =>
        Array.from({ length: 24 }, (_, hour) => ({
            id: `alarm-${hour}`,
            time: formatTime12Hour(hour),
            hour,
            enabled: false,
            identifier: null,
        }));
    const [alarms, setAlarms] = useState<Alarm[]>(generateAlarms());


    const saveAlarmsToStorage = async (alarms: Alarm[]) => {
        try {
            await AsyncStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(alarms));
        } catch (error) {
            console.error('Failed to save alarms:', error);
        }
    };

    const loadAlarmsFromStorage = async () => {
        try {
            const storedAlarms = await AsyncStorage.getItem(ALARM_STORAGE_KEY);
            return storedAlarms ? JSON.parse(storedAlarms) : null;
        } catch (error) {
            console.error('Failed to load alarms:', error);
            return null;
        }
    };

    useEffect(() => {
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
        Notifications.cancelAllScheduledNotificationsAsync(); // TODO: cos the fucking things wouldnt stop....

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    useEffect(() => {
        loadAlarmsFromStorage().then((savedAlarms) => {
            if (savedAlarms) {
                console.log(savedAlarms)
                setAlarms(savedAlarms);
            } else {
                setAlarms(generateAlarms()); // Default alarms if none are saved
            }
        });
    }, []);

    async function registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('myNotificationChannel', {
                name: 'hourly_chime',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
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
            // Learn more about projectId:
            // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
            // EAS projectId is used here.
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
                sound: "twangy_old_clock.wav"
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 10
                // hour: 12,
                // minute: 5,
            },
        });
        console.log(identifier)
        return identifier
    }

    const toggleAlarm = (alarm_id: string) => {
        setAlarms((prevAlarms) =>
            prevAlarms.map((alarm) => {
                if (alarm.id === alarm_id) {
                    const newEnabledState = !alarm.enabled;
                    if (newEnabledState) {
                        // Enable alarm and set identifier
                        enableChime(alarm.hour).then((notification_id) => {
                            setAlarms((currentAlarms) => {
                                const alarmsWithId = currentAlarms.map((a) =>
                                    a.id === alarm_id ? { ...a, identifier: notification_id } : a
                                )
                                saveAlarmsToStorage(alarmsWithId); // Save after update
                                console.log('Enabled chime ID: ', notification_id)
                                return alarmsWithId;
                            });
                        });
                    } else {
                        // Disable alarm and cancel notification
                        if (alarm.identifier) {
                            Notifications.cancelScheduledNotificationAsync(alarm.identifier);
                            setAlarms((currentAlarms) => {
                                const alarmsWithoutId = currentAlarms.map((a) =>
                                    a.id === alarm_id ? { ...a, identifier: null } : a
                                )
                                saveAlarmsToStorage(alarmsWithoutId); // Save after update
                                console.log('Disabled chime ID: ', alarm.identifier)
                                return alarmsWithoutId;
                            });
                        }
                    }
                    return { ...alarm, enabled: newEnabledState };
                }
                return alarm;
            })
        );
    };

    const chooseSound = (id: String) => {
        alert(`Choose sound for alarm ID: ${id}`);
    };

    const renderAlarmItem = ({ item }) => (
        <TouchableOpacity style={styles.alarmCard} onPress={() => toggleAlarm(item.id)}>
            <View style={styles.alarmContent}>
                <Text style={styles.alarmTime}>{item.time}</Text>
                {/* <Button style={styles.soundButton} title='choose sound' onPress={() => chooseSound(item.id)} /> */}
                <Switch
                    value={item.enabled}
                    onValueChange={() => toggleAlarm(item.id)}
                />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Alarms</Text>
            <FlatList
                data={alarms}
                renderItem={renderAlarmItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
            />
            {/* <Link href={'/notifications_page'}> got to page</Link> */}
            {/* <Button style={styles.addButton} title='Test a notification' onPress={toggleAlarm}>
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
    alarmCard: {
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
    alarmContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    alarmTime: {
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

// export default AlarmView;
