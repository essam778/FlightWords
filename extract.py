import sys

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract CSS (lines 9 to 465, 0-indexed: 8 to 465)
css_lines = lines[8:465]
with open('style.css', 'w', encoding='utf-8') as f:
    f.writelines(css_lines)

# Extract Data (lines 670 to 2541, 0-indexed: 669 to 2541)
data_lines = lines[669:2541]
with open('data.js', 'w', encoding='utf-8') as f:
    f.writelines(data_lines)

# Extract Logic (lines 2543 to 3252, 0-indexed: 2542 to 3252)
logic_lines = lines[2542:3252]
with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(logic_lines)

# Create new index.html
new_index_lines = []
new_index_lines.extend(lines[:7]) # lines 1-7
new_index_lines.append('<link rel="stylesheet" href="style.css">\n')
new_index_lines.extend(lines[467:669]) # lines 468-669
new_index_lines.append('<script src="data.js"></script>\n')
new_index_lines.append('<script src="app.js"></script>\n')
new_index_lines.extend(lines[3252:]) # the rest (</script>\n</body>\n</html>)

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_index_lines)

print("Extraction complete.")
