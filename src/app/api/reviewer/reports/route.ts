import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Strict RBAC: Only reviewers can access this route
    if (!session || !session.user || (session.user as any).role !== 'REVIEWER') {
      return NextResponse.json({ error: 'Unauthorized. Only reviewers can access this data.' }, { status: 403 });
    }

    const reviewerId = (session.user as any).id;

    // Fetch reports WITH user pseudonym (but NEVER joining Identity table)
    const reports = await prisma.report.findMany({
      include: {
        user: {
          select: {
            pseudonym: true, // Only select pseudonym. Never identity.
          }
        },
        evidence: {
          select: {
            id: true,
            mimeType: true,
            size: true,
            fileHash: true,
            // DO NOT select filePath, iv, authTag here if we want to restrict direct download access
            // but for MVP dashboard, we might just show that evidence exists.
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Log the audit event for every report accessed
    // In a real app, you might log only when a specific report details are viewed,
    // but here we log the list view as a batch or individual events.
    const auditLogs = reports.map(report => ({
      reportId: report.id,
      reviewerId: reviewerId,
      action: 'VIEW_REPORT_LIST',
    }));

    if (auditLogs.length > 0) {
      await prisma.auditLog.createMany({
        data: auditLogs
      });
    }

    // Format the response to ensure identity separation is obvious
    const safeReports = reports.map(r => ({
      id: r.id,
      category: r.category,
      description: r.description,
      date: r.date,
      location: r.location,
      createdAt: r.createdAt,
      reporterPseudonym: r.user.pseudonym, // Only pseudonym
      evidenceCount: r.evidence.length,
      evidence: r.evidence
    }));

    return NextResponse.json({ reports: safeReports });
  } catch (error: any) {
    console.error("Error fetching reviewer reports:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
