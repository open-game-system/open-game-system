#!/bin/zsh
# CPU % (100 = one Mac core) of every process under one Simulator device, sampled N times, and the mean.
# Simulator processes are Mac processes: an upper bound for the phone, not a phone measurement.
UDID=$1; N=${2:-10}
LD=$(ps -axo pid=,command= | grep launchd_sim | grep "$UDID" | grep -v grep | awk '{print $1}')
for i in $(seq $N); do
  ps -axo pid=,ppid=,pcpu=,ucomm= | awk -v root=$LD '
    { p=$1; pp[p]=$2; cpu[p]=$3; $1=""; $2=""; $3=""; sub(/^ +/, ""); name[p]=$0 }
    END { for (p in pp) { q=p; while (q!="" && q!=root && q!=1 && q!=0) q=pp[q]; if (q==root) { s[name[p]]+=cpu[p]; t+=cpu[p] } }
          out=sprintf("total %.0f", t); for (k in s) if (s[k] >= 3) out=out sprintf(" | %s %.0f", k, s[k]); print out }'
  sleep 1
done
