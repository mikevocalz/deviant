/**
 * Payload CMS Media Upload Client
 * 
 * Handles media uploads to Payload CMS /api/media endpoint
 */

import { getAuthToken } from "./auth-client";

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

/**
 * Upload a file to Payload CMS media collection
 */
export async function uploadToPayload(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<UploadResult> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  console.log("[PayloadMedia] uploadToPayload called", { uri, folder, userId });
  
  if (!apiUrl) {
    console.error("[PayloadMedia] API URL not configured");
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: "API URL not configured",
    };
  }

  try {
    // Get auth token
    const token = await getAuthToken();
    if (!token) {
      console.error("[PayloadMedia] No auth token available");
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: "Not authenticated",
      };
    }

    // Get filename from URI
    const filename = uri.split('/').pop() || `upload-${Date.now()}.jpg`;
    
    console.log("[PayloadMedia] Preparing upload for:", filename);

    // Create FormData with proper React Native format - NO BLOB
    // React Native FormData can handle file URIs directly
    const formData = new FormData();
    
    // React Native requires this specific format for file uploads
    const file: any = {
      uri: uri,
      type: 'image/jpeg', // Default to jpeg, Payload will handle detection
      name: filename,
    };
    
    formData.append('file', file);

    const uploadUrl = `${apiUrl}/api/upload`;
    console.log("[PayloadMedia] Uploading to:", uploadUrl);
    console.log("[PayloadMedia] Starting upload...");

    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary
        },
        body: formData,
      });

      console.log("[PayloadMedia] Upload complete, status:", uploadResponse.status);
      
      if (uploadResponse.ok) {
        const responseData = await uploadResponse.json();
        const doc = responseData.doc || responseData;
        
        // Construct full URL
        const mediaUrl = doc.url?.startsWith('http') 
          ? doc.url 
          : `${apiUrl}${doc.url}`;

        console.log("[PayloadMedia] Upload successful, URL:", mediaUrl);
        
        if (onProgress) {
          onProgress({ loaded: 100, total: 100, percentage: 100 });
        }
        
        return {
          success: true,
          url: mediaUrl,
          path: doc.url || "",
          filename: doc.filename || filename,
        };
      } else {
        const errorText = await uploadResponse.text();
        console.error("[PayloadMedia] Upload failed with status:", uploadResponse.status);
        console.error("[PayloadMedia] Error response:", errorText);
        return {
          success: false,
          url: "",
          path: "",
          filename: "",
          error: `Upload failed: ${uploadResponse.status} - ${errorText}`,
        };
      }
    } catch (fetchError) {
      console.error("[PayloadMedia] Fetch error:", fetchError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: fetchError instanceof Error ? fetchError.message : "Upload failed",
      };
    }
  } catch (error) {
    console.error("[PayloadMedia] Upload error:", error);
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload multiple files to Payload CMS
 */
export async function uploadMultipleToPayload(
  files: Array<{ uri: string; type: "image" | "video" }>,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<Array<{ type: "image" | "video"; url: string; success: boolean }>> {
  const results: Array<{
    type: "image" | "video";
    url: string;
    success: boolean;
  }> = [];
  const totalFiles = files.length;
  let completedFiles = 0;

  for (const file of files) {
    const result = await uploadToPayload(
      file.uri,
      folder,
      (fileProgress) => {
        if (onProgress) {
          // Calculate overall progress
          const fileContribution = fileProgress.percentage / totalFiles;
          const completedContribution = (completedFiles / totalFiles) * 100;
          onProgress({
            loaded: completedFiles + fileProgress.percentage / 100,
            total: totalFiles,
            percentage: Math.round(completedContribution + fileContribution),
          });
        }
      },
      userId,
    );

    results.push({
      type: file.type,
      url: result.url,
      success: result.success,
    });

    completedFiles++;
  }

  return results;
}
