num=$(sudo conntrack -L | grep -e '10.9' | grep -e '10.10' | wc -l)

echo $num
echo "$(date '+%s'),$num" >> log/ubnt.csv
