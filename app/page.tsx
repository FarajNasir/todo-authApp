import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Todo Auth Project
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Login or Signup to continue to your dashboard.
          </p>

          <div className="flex gap-3">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Login
              </Button>
            </Link>

            <Link href="/signup" className="w-full">
              <Button className="w-full">Signup</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
