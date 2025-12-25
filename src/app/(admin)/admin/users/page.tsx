import { db } from "@/lib/db";
import {
    Search,
    MoreVertical,
    Shield,
    UserCog,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";

async function getUsers() {
    const users = await db.user.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: {
                    projectMembers: true,
                    activities: true,
                },
            },
        },
    });

    return users;
}

export default async function UsersPage() {
    const users = await getUsers();

    return (
        <div className="space-y-12">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-5xl font-serif">Users</h1>
                    <p className="text-muted font-serif italic text-lg mt-2">
                        {users.length} registered users
                    </p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="pl-10 pr-4 py-2 border border-border bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                </div>
            </header>

            <div className="accent-line" />

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Projects</TableHead>
                                <TableHead>Activities</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-ink text-paper flex items-center justify-center font-serif">
                                                {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                                            </div>
                                            <div>
                                                <p className="font-medium">{user.name || "Unnamed"}</p>
                                                <p className="text-sm text-muted">{user.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <RoleBadge role={user.role} />
                                    </TableCell>
                                    <TableCell>{user._count.projectMembers}</TableCell>
                                    <TableCell>{user._count.activities}</TableCell>
                                    <TableCell className="text-muted">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <button className="p-2 hover:bg-ink/5 rounded-sm transition-colors">
                                            <MoreVertical className="w-4 h-4 text-muted" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    switch (role) {
        case "SUPER_ADMIN":
            return (
                <Badge className="gap-1">
                    <Shield className="w-3 h-3" />
                    Super Admin
                </Badge>
            );
        case "ADMIN":
            return (
                <Badge variant="secondary" className="gap-1">
                    <UserCog className="w-3 h-3" />
                    Admin
                </Badge>
            );
        default:
            return <Badge variant="outline">User</Badge>;
    }
}
