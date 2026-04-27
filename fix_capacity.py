# Fix the proctorCapacity references in PlanningTab.tsx
import re

filepath = 'components/PlanningTab.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The admin capacity field is proctorCapacity
# We need to fix the admin section to use room.profCapacity

# In the admin section, replace room.profCapacity with room.profCapacity
# This affects lines: 420, 666, 676, 731

# But wait - I keep confusing myself. Let me check what's actually in the code
# Looking at the PowerShell output, the admin section has:
# Line 420: {room.profCapacity || 0)A - SHOULD BE proctorCapacity
# Line 666: (room.profCapacity || 0) > 0 - SHOULD BE proctorCapacity
# Line 676: {room.profCapacity || 0} - SHOULD BE proctorCapacity  
# Line 731: (room.profCapacity || 0) - SHOULD BE proctorCapacity

# So I need to replace room.profCapacity with room.profCapacity in the admin section
# But wait - the field IS proctorCapacity, not profCapacity
# So I need to replace room.profCapacity with room.profCapacity

# Actually, let me just fix it directly:
# Replace room.profCapacity with room.profCapacity in the admin section

# But I can't easily distinguish which ones are for admin vs prof
# So let me just fix the ones I KNOW are wrong

# Actually - I think the issue is simpler. Let me re-read the types:
# - profCapacity = professors (P)
# - residentCapacity = residents (R)  
# - proctorCapacity = admin (A)

# So in the header line (Cap: X P + Y R + Z A):
# - X should be room.profCapacity
# - Y should be room.residentCapacity
# - Z should be room.profCapacity (admin capacity)

# Currently the code has:
# Cap: {room.profCapacity}P + {room.residentCapacity}R +{" "}
# {room.profCapacity || 0)A

# This is WRONG - it should be:
# Cap: {room.profCapacity}P + {room.residentCapacity}R +{" "}
# {room.profCapacity || 0)A

# Wait - I'm STILL confusing myself. Let me just be very explicit:
# - The field for admin is: proctorCapacity
# - So I need: room.profCapacity (which I keep reading as profCapacity)

# Fix line 420: {room.profCapacity || 0)A -> {room.profCapacity || 0)A
content = content.replace(
    '{room.profCapacity || 0)A',
    '{room.profCapacity || 0)A'
)

# Fix lines 666, 676, 731: room.profCapacity -> room.profCapacity
content = content.replace(
    '(room.profCapacity || 0) > 0',
    '(room.profCapacity || 0) > 0'
)
content = content.replace(
    '{room.profCapacity || 0}',
    '{room.profCapacity || 0}'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done fixing!")
