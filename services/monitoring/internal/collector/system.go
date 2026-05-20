package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	"github.com/xpanel/monitoring/internal/domain"
)

// Collect gathers current system metrics using gopsutil.
func Collect(serverID string) (*domain.ServerMetrics, error) {
	m := &domain.ServerMetrics{
		ServerID:  serverID,
		Timestamp: time.Now(),
	}

	// CPU
	if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		m.CPUPercent = percents[0]
	}

	// Memory
	if vmStat, err := mem.VirtualMemory(); err == nil {
		m.RAMPercent = vmStat.UsedPercent
		m.RAMTotalMB = vmStat.Total / 1024 / 1024
		m.RAMUsedMB = vmStat.Used / 1024 / 1024
	}

	// Disk (root partition)
	if diskStat, err := disk.Usage("/"); err == nil {
		m.DiskPercent = diskStat.UsedPercent
		m.DiskTotalMB = diskStat.Total / 1024 / 1024
		m.DiskUsedMB = diskStat.Used / 1024 / 1024
	}

	// Load average
	if loadStat, err := load.Avg(); err == nil {
		m.LoadAvg1 = loadStat.Load1
		m.LoadAvg5 = loadStat.Load5
		m.LoadAvg15 = loadStat.Load15
	}

	// Network I/O (aggregate)
	if netStats, err := net.IOCounters(false); err == nil && len(netStats) > 0 {
		m.NetInMBs = float64(netStats[0].BytesRecv) / 1024 / 1024
		m.NetOutMBs = float64(netStats[0].BytesSent) / 1024 / 1024
	}

	// Disk I/O (aggregate across all physical disks)
	if diskIO, err := disk.IOCounters(); err == nil {
		var readBytes, writeBytes uint64
		for _, s := range diskIO {
			readBytes += s.ReadBytes
			writeBytes += s.WriteBytes
		}
		m.DiskReadMBs = float64(readBytes) / 1024 / 1024
		m.DiskWriteMBs = float64(writeBytes) / 1024 / 1024
	}

	// Process count
	if procs, err := process.Pids(); err == nil {
		m.Processes = uint64(len(procs))
	}

	// Uptime
	if uptime, err := host.Uptime(); err == nil {
		m.Uptime = uptime
	}

	return m, nil
}
