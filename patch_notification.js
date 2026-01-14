const fs = require('fs');
const path = 'c:/ProjectManagement/backend/src/controllers/messageController.ts';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Loose regex matches the function call regardless of newlines/spaces
    const looseRegex = /await\s+notifyProjectDiscussion\s*\(\s*parseInt\(\s*projectId\s*\)\s*,\s*userId\s*,\s*`đã gửi một \${typeLabel}`\s*,\s*parseInt\(\s*projectId\s*\)\s*\/\/\s*use projectId as contextId\s*\)\s*;/;

    const replacement = `// Fetch project members and sender info for notification
            const [project, sender] = await Promise.all([
                prisma.project.findUnique({
                    where: { id: parseInt(projectId) },
                    include: {
                        manager: { select: { id: true } },
                        implementers: { select: { id: true } },
                        cooperators: { select: { id: true } },
                        followers: { select: { id: true } }
                    }
                }),
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true }
                })
            ]);

            if (project && sender) {
                const recipientIds = new Set<number>();
                if (project.managerId) recipientIds.add(project.managerId);
                project.implementers.forEach(u => recipientIds.add(u.id));
                project.cooperators.forEach(u => recipientIds.add(u.id));
                project.followers.forEach(u => recipientIds.add(u.id));
                recipientIds.delete(userId); // Exclude sender

                if (recipientIds.size > 0) {
                    await notifyProjectDiscussion(
                        Array.from(recipientIds),
                        userId,
                        sender.name,
                        parseInt(projectId),
                        project.name,
                        \`đã gửi một \${typeLabel}\`
                    );
                }
            }`;

    if (looseRegex.test(content)) {
        console.log("Pattern matched, replacing...");
        const newContent = content.replace(looseRegex, replacement);
        fs.writeFileSync(path, newContent, 'utf8');
        console.log("File updated successfully.");
    } else {
        console.log("Pattern NOT found!");
        // Show context for debugging
        const idx = content.indexOf("const typeLabel");
        if (idx !== -1) {
            console.log("Context:\n" + content.substring(idx, idx + 400));
        } else {
            console.log("Context start not found.");
        }
    }

} catch (e) {
    console.error("Error:", e);
}
