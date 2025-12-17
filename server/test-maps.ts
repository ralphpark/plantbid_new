import 'dotenv/config';
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function testGeocoding() {
  console.log('Testing Google Maps Geocoding API...');
  console.log('Key available:', !!GOOGLE_MAPS_API_KEY);
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('No API key found!');
    return;
  }

  // Test coordinates for Seoul City Hall
  const lat = 37.5665;
  const lng = 126.9780;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_API_KEY,
        language: 'ko'
      }
    });

    const result = response.data;
    console.log('Status:', result.status);
    
    if (result.status === 'OK') {
      console.log('Success!');
      if (result.results && result.results.length > 0) {
        console.log('Address:', result.results[0].formatted_address);
      }
    } else {
      console.error('API Error Message:', result.error_message);
    }
  } catch (error: any) {
    console.error('Request failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testGeocoding();
