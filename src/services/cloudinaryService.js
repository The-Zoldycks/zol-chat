/**
 * Uploads an image file to Cloudinary using an unsigned upload preset.
 * @param {string} imageUri - Local URI of the image (e.g., from expo-image-picker)
 * @returns {Promise<string>} - HTTPS URL of the uploaded image on Cloudinary
 */
export async function uploadToCloudinary(imageUri) {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables (EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME / EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET) are missing.');
  }

  const cleanUri = imageUri.split('?')[0];
  const ext = cleanUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap = { png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: mimeType,
    name: `upload_${Date.now()}.${ext}`,
  });
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to upload image to Cloudinary');
  }

  return data.secure_url;
}
