import React, { useState, useEffect } from 'react';
import './ConfigPage.css';

interface DeviceConfig {
  device: {
    name: string;
    location: string;
    timezone: string;
  };
  posthog: {
    api_key: string;
    project_id: string;
    host: string;
  };
  display: {
    refresh_interval: number;
    theme: string;
    brightness: number;
    rotation: number;
    screensaver_timeout: number;
    metrics: {
      top: { type: string; label: string; enabled: boolean };
      left: { type: string; label: string; enabled: boolean };
      right: { type: string; label: string; enabled: boolean };
    };
  };
  network: {
    wifi_ssid: string;
    wifi_password: string;
    static_ip: string;
    use_dhcp: boolean;
  };
  advanced: {
    debug_mode: boolean;
    log_level: string;
    auto_update: boolean;
    backup_enabled: boolean;
  };
  ota: {
    enabled: boolean;
    branch: string;
    check_on_boot: boolean;
    auto_pull: boolean;
    last_update: string | null;
    last_check: string | null;
  };
}

interface AvailableMetrics {
  [key: string]: {
    label: string;
    description: string;
  };
}

interface DeviceInfo {
  device: {
    name: string;
    location: string;
    last_configured: string | null;
  };
  system: {
    platform: string;
    platform_version?: string;
    architecture?: string;
    hostname: string;
    python_version: string;
  };
  performance: {
    cpu_percent?: number;
    memory_percent?: number;
    memory_used_gb?: number;
    memory_total_gb?: number;
    disk_percent?: number;
    disk_free_gb?: number;
    disk_total_gb?: number;
    error?: string;
  };
}

interface OTAStatus {
  enabled: boolean;
  current_branch: string;
  current_commit: string;
  target_branch: string;
  available_branches: string[];
  auto_pull: boolean;
  check_on_boot: boolean;
  last_update: string | null;
  last_check: string | null;
  repo_path: string;
}

const ConfigPage: React.FC = () => {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [otaStatus, setOtaStatus] = useState<OTAStatus | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetrics>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('device');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updating, setUpdating] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    loadConfig();
    loadDeviceInfo();
    loadOTAStatus();
    loadAvailableMetrics();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`);
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      showMessage('error', 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/device/info`);
      const data = await response.json();
      setDeviceInfo(data);
    } catch (error) {
      console.error('Failed to load device info:', error);
    }
  };

  const loadOTAStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/ota/status`);
      const data = await response.json();
      setOtaStatus(data);
    } catch (error) {
      console.error('Failed to load OTA status:', error);
    }
  };

  const loadAvailableMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/metrics/available`);
      const data = await response.json();
      setAvailableMetrics(data);
    } catch (error) {
      console.error('Failed to load available metrics:', error);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Configuration saved successfully');
        loadDeviceInfo(); // Refresh device info
      } else {
        showMessage('error', result.error || 'Failed to save configuration');
      }
    } catch (error) {
      showMessage('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const testPostHogConnection = async () => {
    if (!config) return;

    setTestingConnection(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/config/validate/posthog`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config.posthog),
        },
      );

      const result = await response.json();
      if (result.valid) {
        showMessage('success', result.message);
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', 'Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  const resetConfig = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset all settings to defaults?',
      )
    )
      return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/config/reset`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Configuration reset to defaults');
        loadConfig();
      } else {
        showMessage('error', result.error || 'Failed to reset configuration');
      }
    } catch (error) {
      showMessage('error', 'Failed to reset configuration');
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/ota/check`);
      const result = await response.json();

      if (result.error) {
        showMessage('error', result.error);
      } else if (result.updates_available) {
        showMessage('success', `${result.commits_behind} updates available`);
      } else {
        showMessage('success', 'No updates available');
      }

      loadOTAStatus();
    } catch (error) {
      showMessage('error', 'Failed to check for updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const updateSystem = async () => {
    if (
      !window.confirm(
        'Are you sure you want to update the system? This will restart the application.',
      )
    )
      return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/ota/update`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'System updated successfully');
        loadOTAStatus();
      } else {
        showMessage('error', result.error || 'Failed to update system');
      }
    } catch (error) {
      showMessage('error', 'Failed to update system');
    } finally {
      setUpdating(false);
    }
  };

  const switchBranch = async (branch: string) => {
    if (
      !window.confirm(
        `Are you sure you want to switch to branch ${branch}? This will restart the application.`,
      )
    )
      return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/ota/switch-branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', result.message);
        loadOTAStatus();
        loadConfig();
      } else {
        showMessage('error', result.error || 'Failed to switch branch');
      }
    } catch (error) {
      showMessage('error', 'Failed to switch branch');
    } finally {
      setUpdating(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const updateConfig = (
    section: keyof DeviceConfig,
    field: string,
    value: any,
  ) => {
    if (!config) return;

    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value,
      },
    });
  };

  const tabs = [
    { id: 'device', label: 'Device', icon: '🔧' },
    { id: 'posthog', label: 'PostHog', icon: '📊' },
    { id: 'display', label: 'Display', icon: '🖥️' },
    { id: 'network', label: 'Network', icon: '🌐' },
    { id: 'advanced', label: 'Advanced', icon: '⚙️' },
    { id: 'ota', label: 'Updates', icon: '🔄' },
    { id: 'info', label: 'System Info', icon: 'ℹ️' },
  ];

  if (loading) {
    return (
      <div className="config-page loading">
        <div className="loading-spinner"></div>
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="config-page error">
        <h2>Error</h2>
        <p>Failed to load configuration</p>
        <button onClick={loadConfig}>Retry</button>
      </div>
    );
  }

  return (
    <div className="config-page">
      <header className="config-header">
        <h1>📱 PostHog Pi Configuration</h1>
        <div className="header-actions">
          <button
            onClick={() => (window.location.href = '/')}
            className="btn-secondary"
          >
            📊 Dashboard
          </button>
          <button
            onClick={resetConfig}
            className="btn-danger"
            title="Reset to defaults"
          >
            🔄 Reset
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? '💾 Saving...' : '💾 Save'}
          </button>
        </div>
      </header>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="config-content">
        <nav className="config-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="config-panel">
          {activeTab === 'device' && (
            <div className="config-section">
              <h2>Device Settings</h2>
              <div className="form-group">
                <label>Device Name</label>
                <input
                  type="text"
                  value={config.device.name}
                  onChange={(e) =>
                    updateConfig('device', 'name', e.target.value)
                  }
                  placeholder="PostHog Pi Dashboard"
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={config.device.location}
                  onChange={(e) =>
                    updateConfig('device', 'location', e.target.value)
                  }
                  placeholder="Office, Living Room, etc."
                />
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={config.device.timezone}
                  onChange={(e) =>
                    updateConfig('device', 'timezone', e.target.value)
                  }
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'posthog' && (
            <div className="config-section">
              <h2>PostHog Configuration</h2>
              <div className="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={config.posthog.api_key}
                  onChange={(e) =>
                    updateConfig('posthog', 'api_key', e.target.value)
                  }
                  placeholder="Your PostHog API key"
                />
              </div>
              <div className="form-group">
                <label>Project ID</label>
                <input
                  type="text"
                  value={config.posthog.project_id}
                  onChange={(e) =>
                    updateConfig('posthog', 'project_id', e.target.value)
                  }
                  placeholder="Your PostHog project ID"
                />
              </div>
              <div className="form-group">
                <label>Host URL</label>
                <input
                  type="url"
                  value={config.posthog.host}
                  onChange={(e) =>
                    updateConfig('posthog', 'host', e.target.value)
                  }
                  placeholder="https://app.posthog.com"
                />
              </div>
              <button
                onClick={testPostHogConnection}
                disabled={testingConnection}
                className="btn-secondary"
              >
                {testingConnection ? '🔄 Testing...' : '🧪 Test Connection'}
              </button>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="config-section">
              <h2>Display Settings</h2>
              <div className="form-group">
                <label>Refresh Interval (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={config.display.refresh_interval}
                  onChange={(e) =>
                    updateConfig(
                      'display',
                      'refresh_interval',
                      parseInt(e.target.value),
                    )
                  }
                />
              </div>
              <div className="form-group">
                <label>Theme</label>
                <select
                  value={config.display.theme}
                  onChange={(e) =>
                    updateConfig('display', 'theme', e.target.value)
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="form-group">
                <label>Brightness (%)</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={config.display.brightness}
                  onChange={(e) =>
                    updateConfig(
                      'display',
                      'brightness',
                      parseInt(e.target.value),
                    )
                  }
                />
                <span>{config.display.brightness}%</span>
              </div>
              <div className="form-group">
                <label>Rotation (degrees)</label>
                <select
                  value={config.display.rotation}
                  onChange={(e) =>
                    updateConfig(
                      'display',
                      'rotation',
                      parseInt(e.target.value),
                    )
                  }
                >
                  <option value="0">0°</option>
                  <option value="90">90°</option>
                  <option value="180">180°</option>
                  <option value="270">270°</option>
                </select>
              </div>

              <h3>Dashboard Metrics</h3>
              <p>Configure which metrics are displayed on the dashboard</p>

              {['top', 'left', 'right'].map((position) => (
                <div key={position} className="metric-config-group">
                  <h4>
                    {position.charAt(0).toUpperCase() + position.slice(1)}{' '}
                    Position
                  </h4>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          config.display.metrics[
                            position as keyof typeof config.display.metrics
                          ].enabled
                        }
                        onChange={(e) => {
                          const newMetrics = { ...config.display.metrics };
                          newMetrics[
                            position as keyof typeof newMetrics
                          ].enabled = e.target.checked;
                          updateConfig('display', 'metrics', newMetrics);
                        }}
                      />
                      Enable metric
                    </label>
                  </div>
                  {config.display.metrics[
                    position as keyof typeof config.display.metrics
                  ].enabled && (
                    <>
                      <div className="form-group">
                        <label>Metric Type</label>
                        <select
                          value={
                            config.display.metrics[
                              position as keyof typeof config.display.metrics
                            ].type
                          }
                          onChange={(e) => {
                            const newMetrics = { ...config.display.metrics };
                            const selectedMetric =
                              availableMetrics[e.target.value];
                            newMetrics[position as keyof typeof newMetrics] = {
                              type: e.target.value,
                              label: selectedMetric?.label || e.target.value,
                              enabled: true,
                            };
                            updateConfig('display', 'metrics', newMetrics);
                          }}
                        >
                          {Object.entries(availableMetrics).map(
                            ([key, metric]) => (
                              <option key={key} value={key}>
                                {metric.label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Display Label</label>
                        <input
                          type="text"
                          value={
                            config.display.metrics[
                              position as keyof typeof config.display.metrics
                            ].label
                          }
                          onChange={(e) => {
                            const newMetrics = { ...config.display.metrics };
                            newMetrics[
                              position as keyof typeof newMetrics
                            ].label = e.target.value;
                            updateConfig('display', 'metrics', newMetrics);
                          }}
                          placeholder="Custom label"
                        />
                      </div>
                      <small className="metric-description">
                        {
                          availableMetrics[
                            config.display.metrics[
                              position as keyof typeof config.display.metrics
                            ].type
                          ]?.description
                        }
                      </small>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'network' && (
            <div className="config-section">
              <h2>Network Settings</h2>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.network.use_dhcp}
                    onChange={(e) =>
                      updateConfig('network', 'use_dhcp', e.target.checked)
                    }
                  />
                  Use DHCP (automatic IP)
                </label>
              </div>
              {!config.network.use_dhcp && (
                <div className="form-group">
                  <label>Static IP Address</label>
                  <input
                    type="text"
                    value={config.network.static_ip}
                    onChange={(e) =>
                      updateConfig('network', 'static_ip', e.target.value)
                    }
                    placeholder="192.168.1.100"
                  />
                </div>
              )}
              <div className="form-group">
                <label>WiFi SSID</label>
                <input
                  type="text"
                  value={config.network.wifi_ssid}
                  onChange={(e) =>
                    updateConfig('network', 'wifi_ssid', e.target.value)
                  }
                  placeholder="Your WiFi network name"
                />
              </div>
              <div className="form-group">
                <label>WiFi Password</label>
                <input
                  type="password"
                  value={config.network.wifi_password}
                  onChange={(e) =>
                    updateConfig('network', 'wifi_password', e.target.value)
                  }
                  placeholder="Your WiFi password"
                />
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="config-section">
              <h2>Advanced Settings</h2>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.advanced.debug_mode}
                    onChange={(e) =>
                      updateConfig('advanced', 'debug_mode', e.target.checked)
                    }
                  />
                  Debug Mode
                </label>
              </div>
              <div className="form-group">
                <label>Log Level</label>
                <select
                  value={config.advanced.log_level}
                  onChange={(e) =>
                    updateConfig('advanced', 'log_level', e.target.value)
                  }
                >
                  <option value="DEBUG">Debug</option>
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                  <option value="ERROR">Error</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.advanced.auto_update}
                    onChange={(e) =>
                      updateConfig('advanced', 'auto_update', e.target.checked)
                    }
                  />
                  Auto Update
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.advanced.backup_enabled}
                    onChange={(e) =>
                      updateConfig(
                        'advanced',
                        'backup_enabled',
                        e.target.checked,
                      )
                    }
                  />
                  Enable Backups
                </label>
              </div>
            </div>
          )}

          {activeTab === 'ota' && (
            <div className="config-section">
              <h2>Over-The-Air Updates</h2>

              {otaStatus && (
                <div className="ota-status">
                  <div className="info-grid">
                    <div className="info-card">
                      <h3>Current Status</h3>
                      <p>
                        <strong>Branch:</strong> {otaStatus.current_branch}
                      </p>
                      <p>
                        <strong>Commit:</strong> {otaStatus.current_commit}
                      </p>
                      <p>
                        <strong>Last Check:</strong>{' '}
                        {otaStatus.last_check
                          ? new Date(otaStatus.last_check).toLocaleString()
                          : 'Never'}
                      </p>
                      <p>
                        <strong>Last Update:</strong>{' '}
                        {otaStatus.last_update
                          ? new Date(otaStatus.last_update).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>

                    <div className="info-card">
                      <h3>Actions</h3>
                      <div className="button-group">
                        <button
                          onClick={checkForUpdates}
                          disabled={checkingUpdates}
                          className="btn-secondary"
                        >
                          {checkingUpdates
                            ? '🔄 Checking...'
                            : '🔍 Check for Updates'}
                        </button>
                        <button
                          onClick={updateSystem}
                          disabled={updating}
                          className="btn-primary"
                        >
                          {updating ? '🔄 Updating...' : '⬆️ Update System'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.ota?.enabled || false}
                    onChange={(e) =>
                      updateConfig('ota', 'enabled', e.target.checked)
                    }
                  />
                  Enable OTA Updates
                </label>
              </div>

              <div className="form-group">
                <label>Target Branch</label>
                <select
                  value={config?.ota?.branch || 'main'}
                  onChange={(e) => {
                    updateConfig('ota', 'branch', e.target.value);
                    if (e.target.value !== otaStatus?.current_branch) {
                      switchBranch(e.target.value);
                    }
                  }}
                  disabled={updating}
                >
                  {otaStatus?.available_branches?.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  )) || (
                    <>
                      <option value="main">main</option>
                      <option value="dev">dev</option>
                      <option value="canary">canary</option>
                    </>
                  )}
                </select>
                <small>Current: {otaStatus?.current_branch || 'unknown'}</small>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.ota?.check_on_boot || false}
                    onChange={(e) =>
                      updateConfig('ota', 'check_on_boot', e.target.checked)
                    }
                  />
                  Check for updates on boot
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.ota?.auto_pull || false}
                    onChange={(e) =>
                      updateConfig('ota', 'auto_pull', e.target.checked)
                    }
                  />
                  Automatically pull updates
                </label>
              </div>

              <div className="form-group">
                <label>Repository Path</label>
                <input
                  type="text"
                  value={otaStatus?.repo_path || ''}
                  readOnly
                  className="readonly"
                />
              </div>
            </div>
          )}

          {activeTab === 'info' && deviceInfo && (
            <div className="config-section">
              <h2>System Information</h2>
              <div className="info-grid">
                <div className="info-card">
                  <h3>Device</h3>
                  <p>
                    <strong>Name:</strong> {deviceInfo.device.name}
                  </p>
                  <p>
                    <strong>Location:</strong> {deviceInfo.device.location}
                  </p>
                  <p>
                    <strong>Last Configured:</strong>{' '}
                    {deviceInfo.device.last_configured
                      ? new Date(
                          deviceInfo.device.last_configured,
                        ).toLocaleString()
                      : 'Never'}
                  </p>
                </div>

                <div className="info-card">
                  <h3>System</h3>
                  <p>
                    <strong>Platform:</strong> {deviceInfo.system.platform}
                  </p>
                  <p>
                    <strong>Hostname:</strong> {deviceInfo.system.hostname}
                  </p>
                  <p>
                    <strong>Python:</strong> {deviceInfo.system.python_version}
                  </p>
                  {deviceInfo.system.architecture && (
                    <p>
                      <strong>Architecture:</strong>{' '}
                      {deviceInfo.system.architecture}
                    </p>
                  )}
                </div>

                <div className="info-card">
                  <h3>Performance</h3>
                  {deviceInfo.performance.error ? (
                    <p className="error">{deviceInfo.performance.error}</p>
                  ) : (
                    <>
                      <p>
                        <strong>CPU Usage:</strong>{' '}
                        {deviceInfo.performance.cpu_percent}%
                      </p>
                      <p>
                        <strong>Memory:</strong>{' '}
                        {deviceInfo.performance.memory_used_gb}GB /{' '}
                        {deviceInfo.performance.memory_total_gb}GB (
                        {deviceInfo.performance.memory_percent}%)
                      </p>
                      <p>
                        <strong>Disk:</strong>{' '}
                        {deviceInfo.performance.disk_free_gb}GB free of{' '}
                        {deviceInfo.performance.disk_total_gb}GB (
                        {deviceInfo.performance.disk_percent}% used)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;
