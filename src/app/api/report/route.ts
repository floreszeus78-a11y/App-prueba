import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processAndStoreFile } from '@/lib/file-processing';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { reportSchema } from '@/lib/validation';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'REPORTER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const formData = await req.formData();

    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const date = formData.get('date') as string;
    const location = formData.get('location') as string;

    const file = formData.get('file') as File | null;

    // Validate inputs
    const parsedData = reportSchema.safeParse({ category, description, date, location });
    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.format() }, { status: 400 });
    }

    // Process file if present and validate size/type
    let evidenceData = null;
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
         return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
      if (!allowedTypes.includes(file.type)) {
         return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
      }
      evidenceData = await processAndStoreFile(file);
    }

    // Create Report
    const report = await prisma.report.create({
      data: {
        userId: userId,
        category: parsedData.data.category,
        description: parsedData.data.description,
        date: new Date(parsedData.data.date),
        location: parsedData.data.location,
        ...(evidenceData && {
          evidence: {
            create: {
              fileName: file!.name,
              mimeType: evidenceData.mimeType,
              size: evidenceData.size,
              fileHash: evidenceData.fileHash,
              filePath: evidenceData.filePath,
              iv: evidenceData.iv,
              authTag: evidenceData.authTag,
            }
          }
        })
      }
    });

    return NextResponse.json({ message: 'Report created successfully', reportId: report.id }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating report:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
