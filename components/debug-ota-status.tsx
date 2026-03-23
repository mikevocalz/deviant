import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Updates from 'expo-updates';

export function DebugOTAStatus() {
  const [info, setInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const getInfo = async () => {
      try {
        setInfo({
          enabled: Updates.isEnabled,
          channel: Updates.channel,
          runtimeVersion: Updates.runtimeVersion,
          currentUpdateId: Updates.updateId,
          isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        });
      } catch (e) {
        setInfo({ error: String(e) });
      }
    };
    getInfo();
  }, []);

  const forceCheck = async () => {
    setChecking(true);
    try {
      console.log('=== MANUAL OTA CHECK ===');
      const check = await Updates.checkForUpdateAsync();
      console.log('Available:', check.isAvailable);
      
      if (check.isAvailable) {
        console.log('Fetching...');
        const result = await Updates.fetchUpdateAsync();
        console.log('Downloaded:', result.isNew);
        
        if (result.isNew) {
          console.log('RELOADING NOW');
          await Updates.reloadAsync();
        } else {
          alert('Update downloaded but not new');
        }
      } else {
        alert('No update available - already on latest');
      }
    } catch (e) {
      console.error('Check failed:', e);
      alert('Error: ' + String(e));
    }
    setChecking(false);
  };

  return (
    <View style={{ padding: 20, backgroundColor: '#000', borderWidth: 2, borderColor: '#f00' }}>
      <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 10 }}>
        {JSON.stringify(info, null, 2)}
      </Text>
      <Pressable
        onPress={forceCheck}
        disabled={checking}
        style={{
          marginTop: 10,
          padding: 10,
          backgroundColor: checking ? '#666' : '#f00',
          borderRadius: 4,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {checking ? 'CHECKING...' : 'FORCE CHECK NOW'}
        </Text>
      </Pressable>
      <Text style={{ color: '#ff0', fontSize: 8, marginTop: 4 }}>
        Expected: 678b2753-fe88-4464-8a09-ed9569b1cf17
      </Text>
    </View>
  );
}
