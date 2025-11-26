/**
 * Office Ally SFTP Client
 * Handles EDI file uploads to Office Ally clearinghouse
 *
 * IMPORTANT: This module uses native Node.js bindings and can ONLY run on the server.
 * Never import this directly in client-side code.
 */

// Dynamic import to avoid bundling in client
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SftpClient = require('ssh2-sftp-client');

export interface SFTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface UploadResult {
  success: boolean;
  fileName?: string;
  remotePath?: string;
  error?: string;
}

function getConfig(): SFTPConfig {
  return {
    host: process.env.OFFICE_ALLY_SFTP_HOST || '',
    port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
    username: process.env.OFFICE_ALLY_SFTP_USERNAME || process.env.OFFICE_ALLY_SFTP_USER || '',
    password: process.env.OFFICE_ALLY_SFTP_PASSWORD || '',
  };
}

/**
 * Test SFTP connection to Office Ally
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const sftp = new SftpClient();
  const config = getConfig();

  if (!config.host || !config.username || !config.password) {
    return {
      success: false,
      error: 'Office Ally SFTP credentials not configured',
    };
  }

  try {
    console.log('[SFTP] Testing connection to', config.host);

    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    // Try to list root directory to verify access
    const files = await sftp.list('/');
    console.log('[SFTP] Connection successful, found directories:', files.map((f: { name: string }) => f.name).join(', '));

    await sftp.end();

    return { success: true };
  } catch (error) {
    console.error('[SFTP] Connection test failed:', error);

    try {
      await sftp.end();
    } catch {
      // Ignore disconnect errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'SFTP connection failed',
    };
  }
}

/**
 * Upload EDI claim file to Office Ally
 * File naming convention: MOONLIT_YYYYMMDD_HHMMSS_ClaimID.837
 * For test mode: OATEST_837P_YYYYMMDD_HHMMSS_ClaimID.txt (per Office Ally docs)
 */
export async function uploadClaim(ediContent: string, claimId: string, testMode: boolean = true): Promise<UploadResult> {
  const sftp = new SftpClient();
  const config = getConfig();

  if (!config.host || !config.username || !config.password) {
    return {
      success: false,
      error: 'Office Ally SFTP credentials not configured',
    };
  }

  try {
    console.log('[SFTP] Connecting to Office Ally for claim upload');

    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    // Generate filename based on mode
    // Test mode: OATEST_837P_YYYY-MM-DDTHH-MM-SS_ClaimID.txt (Office Ally test format)
    // Production: MOONLIT_YYYYMMDD_HHMMSS_ClaimID.837
    const now = new Date();
    const shortId = claimId.substring(0, 8); // Use first 8 chars of UUID

    let fileName: string;
    if (testMode) {
      // Office Ally test format - must include "OATEST" to be treated as test
      const isoTimestamp = now.toISOString().replace(/:/g, '-').split('.')[0];
      fileName = `OATEST_837P_${isoTimestamp}_${shortId}.txt`;
    } else {
      const timestamp = now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '_')
        .split('.')[0];
      fileName = `MOONLIT_${timestamp}_${shortId}.837`;
    }

    // Office Ally uses /outbound for incoming files
    const remotePath = `/outbound/${fileName}`;

    // Convert content to Buffer
    const buffer = Buffer.from(ediContent, 'utf-8');

    console.log('[SFTP] Uploading claim file:', {
      fileName,
      remotePath,
      size: buffer.length,
      testMode,
    });

    if (testMode) {
      console.log('[SFTP] TEST MODE - File includes OATEST prefix, will not be sent to payer');
    }

    await sftp.put(buffer, remotePath);

    console.log('[SFTP] Claim file uploaded successfully');

    await sftp.end();

    return {
      success: true,
      fileName,
      remotePath,
    };
  } catch (error) {
    console.error('[SFTP] Upload failed:', error);

    try {
      await sftp.end();
    } catch {
      // Ignore disconnect errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'SFTP upload failed',
    };
  }
}

/**
 * List files in a directory (for debugging)
 */
export async function listDirectory(path: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
  const sftp = new SftpClient();
  const config = getConfig();

  if (!config.host || !config.username || !config.password) {
    return {
      success: false,
      error: 'Office Ally SFTP credentials not configured',
    };
  }

  try {
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    const files = await sftp.list(path);
    await sftp.end();

    return {
      success: true,
      files: files.map((f: { name: string }) => f.name),
    };
  } catch (error) {
    try {
      await sftp.end();
    } catch {
      // Ignore
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list directory',
    };
  }
}
