
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

interface InvitationPageProps {
    params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
    const { token } = await params;

    const invitation = await db.projectInvitation.findUnique({
        where: { token },
        include: {
            project: true,
            inviter: true,
        },
    });

    if (!invitation) {
        return notFound();
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-paper text-ink">
                <h1 className="text-3xl font-serif mb-4">Invitation Expired</h1>
                <p className="text-muted mb-8">This invitation link has expired.</p>
                <Link href="/" className="btn-editorial">
                    Go Home
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-paper text-ink">
            <div className="max-w-md w-full p-8 border border-border shadow-editorial bg-white">
                <h1 className="text-3xl font-serif mb-2">Project Invitation</h1>
                <div className="h-px bg-ink opacity-10 w-full my-6" />

                <p className="text-lg mb-6 leading-relaxed">
                    <span className="font-bold">{invitation.inviter.name || "A colleague"}</span> has invited you to join <span className="font-serif italic text-xl">{invitation.project.title}</span> as a <span className="font-mono text-sm uppercase tracking-wider">{invitation.role}</span>.
                </p>

                <div className="bg-paper p-4 border-l-2 border-intel-blue mb-8">
                    <p className="text-sm text-muted">
                        To accept this invitation, please register or log in with the email address:
                        <br />
                        <span className="font-bold text-ink">{invitation.email}</span>
                    </p>
                </div>

                <div className="flex gap-4">
                    <Link href={`/login?email=${encodeURIComponent(invitation.email)}`} className="btn-editorial w-full text-center">
                        Accept Invitation
                    </Link>
                </div>
            </div>
        </div>
    );
}
