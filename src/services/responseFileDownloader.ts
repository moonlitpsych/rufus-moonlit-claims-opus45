/**
 * Response File Downloader Service
 * V2: Downloads 999, 277, and 835 response files from Office Ally SFTP
 *
 * Office Ally places response files in /outbound/ directory:
 * - 999: Functional Acknowledgment (file received confirmation)
 * - 277: Claim Status Response (payer accepted/rejected)
 * - 835: Electronic Remittance Advice (payment details)
 *
 * File naming conventions (per Office Ally docs):
 * - 999: FILEID_OriginalFileName_999.999
 * - 277: USERNAME_FILEID_HCFA_277ca_YYYYMMDD.txt or FILEID_EDI_STATUS_HCFA_YYYYMMDD.277
 * - 835: FILEID_ERA_835_5010_YYYYMMDD.835
 */

import type { EDIResponseFileType } from '@/types';

interface DownloadedFile {
  filename: string;
  fileType: EDIResponseFileType;
  content: string;
  size: number;
}

interface DownloadResult {
  success: boolean;
  files: DownloadedFile[];
  skippedFiles: string[]; // Already downloaded files
  error?: string;
}

/**
 * Detect file type from filename
 */
export function detectFileType(filename: string): EDIResponseFileType | null {
  const lower = filename.toLowerCase();

  // 999 Functional Acknowledgment
  if (lower.includes('999') || lower.endsWith('.999')) {
    return '999';
  }

  // 277 Claim Status
  if (lower.includes('277') || lower.endsWith('.277')) {
    return '277';
  }

  // 835 ERA/Payment
  if (lower.includes('835') || lower.endsWith('.835') || lower.includes('era')) {
    return '835';
  }

  return null;
}

/**
 * Check if file matches our naming pattern (contains MOONLIT or test pattern)
 * This helps filter for files related to our submissions
 */
export function isOurFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes('moonlit') ||
    lower.includes('oatest') ||
    // Also include files that look like responses to our submissions
    detectFileType(filename) !== null
  );
}

/**
 * Download response files from Office Ally SFTP
 * Returns new files that haven't been downloaded yet
 */
export async function downloadResponseFiles(
  existingFilenames: string[]
): Promise<DownloadResult> {
  // Dynamic import to avoid bundling ssh2-sftp-client on client side
  const SftpClient = (await import('ssh2-sftp-client')).default;
  const sftp = new SftpClient();

  const existingSet = new Set(existingFilenames);
  const downloadedFiles: DownloadedFile[] = [];
  const skippedFiles: string[] = [];

  try {
    // Get SFTP config
    const config = {
      host: process.env.OFFICE_ALLY_SFTP_HOST || '',
      port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
      username: process.env.OFFICE_ALLY_SFTP_USERNAME || process.env.OFFICE_ALLY_SFTP_USER || '',
      password: process.env.OFFICE_ALLY_SFTP_PASSWORD || '',
    };

    if (!config.host || !config.username || !config.password) {
      return {
        success: false,
        files: [],
        skippedFiles: [],
        error: 'SFTP credentials not configured',
      };
    }

    console.log('[ResponseDownloader] Connecting to Office Ally SFTP...');
    await sftp.connect(config);

    // List files in /outbound/ directory
    const fileList = await sftp.list('/outbound/');
    console.log(`[ResponseDownloader] Found ${fileList.length} files in /outbound/`);

    // Filter for response files (999, 277, 835)
    for (const file of fileList) {
      // Skip directories
      if (file.type === 'd') continue;

      const filename = file.name;
      const fileType = detectFileType(filename);

      // Skip non-response files
      if (!fileType) continue;

      // Skip already downloaded files
      if (existingSet.has(filename)) {
        skippedFiles.push(filename);
        continue;
      }

      try {
        // Download file content
        console.log(`[ResponseDownloader] Downloading ${fileType} file: ${filename}`);
        const remotePath = `/outbound/${filename}`;
        const buffer = await sftp.get(remotePath);
        const content = buffer.toString('utf-8');

        downloadedFiles.push({
          filename,
          fileType,
          content,
          size: file.size,
        });
      } catch (downloadError) {
        console.error(`[ResponseDownloader] Failed to download ${filename}:`, downloadError);
        // Continue with other files
      }
    }

    await sftp.end();

    console.log(`[ResponseDownloader] Downloaded ${downloadedFiles.length} new files, skipped ${skippedFiles.length} existing`);

    return {
      success: true,
      files: downloadedFiles,
      skippedFiles,
    };
  } catch (error) {
    try {
      await sftp.end();
    } catch {
      // Ignore cleanup errors
    }

    console.error('[ResponseDownloader] SFTP error:', error);
    return {
      success: false,
      files: downloadedFiles,
      skippedFiles,
      error: error instanceof Error ? error.message : 'SFTP download failed',
    };
  }
}

/**
 * Test SFTP connection and list available response files
 */
export async function listResponseFiles(): Promise<{
  success: boolean;
  files?: Array<{ name: string; type: EDIResponseFileType | null; size: number }>;
  error?: string;
}> {
  const SftpClient = (await import('ssh2-sftp-client')).default;
  const sftp = new SftpClient();

  try {
    const config = {
      host: process.env.OFFICE_ALLY_SFTP_HOST || '',
      port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
      username: process.env.OFFICE_ALLY_SFTP_USERNAME || process.env.OFFICE_ALLY_SFTP_USER || '',
      password: process.env.OFFICE_ALLY_SFTP_PASSWORD || '',
    };

    await sftp.connect(config);
    const fileList = await sftp.list('/outbound/');
    await sftp.end();

    const responseFiles = fileList
      .filter((f) => f.type !== 'd')
      .map((f) => ({
        name: f.name,
        type: detectFileType(f.name),
        size: f.size,
      }))
      .filter((f) => f.type !== null);

    return {
      success: true,
      files: responseFiles,
    };
  } catch (error) {
    try {
      await sftp.end();
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
    };
  }
}
