import { prisma } from "~/lib/db.server";
import { useLoaderData } from "react-router";

export async function loader() {
    const user = await prisma.user.findMany()
    return {user}
}



export default function UserPage(){
    const users = useLoaderData()
    console.log(users);
    
    
    return (
        <div>
            hello
        </div>
    )
}


