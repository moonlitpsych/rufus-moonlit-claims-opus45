/**
 * GET /api/test-sftp
 * Tests the SFTP connection to Office Ally
 */

import { NextResponse } from 'next/server';
import { testConnection, listDirectory } from '@/services/officeAlly';

export async function GET() {
  try {
    // Test basic connection
    const connectionResult = await testConnection();

    if (!connectionResult.success) {
      return NextResponse.json({
        success: false,
        error: connectionResult.error,
      });
    }

    // Try to list the outbound directory
    const listResult = await listDirectory('/outbound');

    return NextResponse.json({
      success: true,
      message: 'SFTP connection successful',
      outboundFiles: listResult.success ? listResult.files : [],
      outboundError: listResult.error,
    });
  } catch (error) {
    console.error('SFTP test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
