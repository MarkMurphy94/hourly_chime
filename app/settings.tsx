import { View, Text, Switch, StyleSheet, Alert } from "react-native";
import React from 'react'
import { Stack } from "expo-router";

export default function settings() {
    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Settings',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                        fontFamily: 'GuavineDemoRegular-1jGgL'
                    },
                }}
            />
            <View style={styles.settingItem}>
                <Text style={styles.label}>Set chime volume</Text>
                {/* Volume slider */}
            </View>
        </View>
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